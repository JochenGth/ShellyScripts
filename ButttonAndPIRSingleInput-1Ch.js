/// <reference path="../../shelly-script.d.ts" />
// created from vscode

//todo
// input auf button und detached stellen

/********Helper Functions********/

//
// system time
//
function getUpTime_s() {
    return Shelly.getComponentStatus("sys").uptime;
}

//first output has id 0
function isOutputActive(outputId) {
    return Shelly.getComponentStatus("switch", outputId).output;
}



/********Application********/
print("[PIR] SCRIPT START")


// configure inputs as detached buttons
//Shelly.call("Switch.Set", 'id')


// Configuration
let pirMinOnTime_s = 3; // shortest time in seconds which the outputting a signal
let pirLightOnDurationAfterActivity_s = 180; // duration for which the light should stay on after the pir signal stopped

// fetch configuration from key value store 
const configUpdateInterval_ms = 60000;
Timer.set(configUpdateInterval_ms, true, function () {
    Shelly.call(
        "KVS.GetMany",
        { "key": "PIR_*" },
        function (result) {

            // check if key was found
            if (result === undefined
                || result.items === undefined
                || result.items.PIR_minOnDuration_s === undefined
                || result.items.PIR_minOnDuration_s.value === undefined) {
                // create key if it does not exist
                Shelly.call(
                    "KVS.Set",
                    { "key": "PIR_minOnDuration_s", "value": 3 }); // default value 3 seconds
                print("[PIR] created key 'PIR_minOnDuration_s' in KVS");
            }
            else if (result.items.PIR_minOnDuration_s.value != pirMinOnTime_s) {
                pirMinOnTime_s = result.items.PIR_minOnDuration_s.value;
                print("[PIR] pirMinOnTime_s got updated from KVS:" + result.items.PIR_minOnDuration_s.value);
            }

            // check if key was found
            if (result === undefined
                || result.items === undefined
                || result.items.PIR_lightOnDuration_s === undefined
                || result.items.PIR_lightOnDuration_s.value === undefined) {
                // create key if it does not exist
                Shelly.call(
                    "KVS.Set",
                    { "key": "PIR_lightOnDuration_s", "value": 180 }); // default value 180 seconds
                print("[PIR] created key 'PIR_lightOnDuration_s' in KVS");
            }
            else if (result.items.PIR_lightOnDuration_s.value != pirLightOnDurationAfterActivity_s) {
                pirLightOnDurationAfterActivity_s = result.items.PIR_lightOnDuration_s.value;
                print("[PIR] pirLightOnDurationAfterActivity_s got updated from KVS:" + result.items.PIR_lightOnDuration_s.value);
            }

        }
    )
});

// this script can handle a pir sensor and a push button on a single input of the shelly
// set input to button and detached mode to make it work
// light will be switched on  at a rising edge
// light will be switched of  after at the falling edge of a short high signal
// light will switched off after pirLightOnDurationAfterActivity_s seconds after falling edge of signal 

// persistent variables
let timeStampPressed = Array(0);
let wasOnBeforeEvent = Array(false);
let timerHandle = Array();

Shelly.addEventHandler(function (event) {

    for (channel = 0; channel < 1; channel++) {
        let inputName = "input:" + channel;
        if (event.component === inputName) {
            if (event.info.event === "btn_down") {
                timeStampPressed[channel] = getUpTime_s();
                print("[PIR] ch:" + channel + "| button pressed");

                wasOnBeforeEvent[channel] = isOutputActive(channel);

                //switch on, even though it might already be on, we currently don't know if it is a human or the pir sensor 
                Shelly.call("Switch.set", { 'id': channel, 'on': true });

                // stop potentially running timer
                if(timerHandle[channel] != undefined
                {
                    timerStopret = Timer.clear(timerHandle[channel]);
                    if (timerStopret) {
                        print("[PIR] ch:" + channel + "| stopped switch off timer");
                    }
                }


            } else if (event.info.event === "btn_up") {
                onDuration = getUpTime_s() - timeStampPressed[channel];
                print("[PIR] ch:" + channel + "| button released after " + onDuration + " s");

                triggerdByPIR = onDuration >= pirMinOnTime_s

                if (triggerdByPIR) {
                    print("[PIR] ch:" + channel + "| triggered by PIR  ==> (re)set off timer");

                    // check if switched on by human (on, but no timer running, )
                    if (wasOnBeforeEvent[channel] === true && timerHandle[channel] === undefined) {
                        print("[PIR] ch:" + channel + "| PIR active but light was already switched on by human ==> ignore pir signal");
                        return;
                    }

                    //(re)start of timer
                    print("[PIR] ch:" + channel + "| PIR active: " + (timerHandle[channel] != undefined ? "reactivate" : "activate") + " switch off timer");
                    timerHandle[channel] = Timer.set(pirLightOnDurationAfterActivity_s * 1000, false, function (channel) {
                        print("[PIR] ch:" + channel + "| switch off by timer");
                        Shelly.call("Switch.set", { 'id': channel, 'on': false });
                    }, channel);
                }
                else {
                    print("[PIR] ch:" + channel + "| triggered by human ==> toggle output");

                    // stop off timer
                    if(timerHandle[channel] != undefined
                    {
                        ret = Timer.clear(timerHandle[channel]);
                    
                        if (ret != undefined) {
                            print("[PIR] ch:" + channel + "| pir off timer was running and got stopped now");
                        }
                    }

                    print("[PIR] ch:" + channel + "| Output before event: " + (wasOnBeforeEvent[channel] ? "on" : "off"));
                    Shelly.call("Switch.set", { 'id': channel, 'on': !wasOnBeforeEvent[channel] }); // toggle previous state
                    print("[PIR] ch:" + channel + "| Output after event: " + (!wasOnBeforeEvent[channel] ? "on" : "off"));
                }
            }
        }
    }
});