argv = require('yargs')
    .usage('Usage: $0 -p PortName -s y [-w dataToWrite]')
    .help('h')
    .alias('h','help')
    .alias('p','port')
    .nargs('p',1)
    .describe('p','Serial Port, found in /dev/tty.usb*')
    .require(['p','s'])
    .alias('s','sync')
    .nargs('s',1)
    .default('s','y')
    .describe('s','Sync Flag, y to wait for synched timestamps, t to test if it can successfully sync, and n to use time of reception instead.')
    .choices('s',['y','t','n'])
    .alias('w','write')
    .nargs('w',1)
    .describe('w','Data to be sent, one character at a time, to the board when ready. Ex: 1234567 would turn off all channels except 8.')
    .argv


portName = argv.p;
dataToWrite = argv.w;
waitForSyncChar = argv.s;

switch(waitForSyncChar){
    case 'y':
        waitForSync = true;
        printVals = true;
        synching=true;
        break;
    case 't':
        waitForSync = true;
        printVals = false;
        synching = true;
        break;
    case 'n':
        waitForSync = false;
        printVals = true;
        synching = false;
        break;
    default:
        console.log('-s flag must contain y, t, or n to dictate wynchronization behavior.')
        process.exit(1)
}
console.log(argv)
// Construct LSL Handoff Python Shell
var spawn = require('child_process').spawn;
lslE = spawn('python', ['LslHandoff.py','OpenBCI_EEG','EEG','8','f'],{stdio: ['pipe','pipe','ignore']});
lslA = spawn('python', ['LslHandoff.py','OpenBCI_AUX','AUX','1','s'],{stdio: ['pipe','pipe','ignore']});

lslE.stdout.on('data', function(message){
    console.log('LSLE: ' + message);
});
lslA.stdout.on('data', function(message){
    console.log('LSLA: ' + message);
});
console.log('Python Shell Created for LSLHandoff');
lslA.on('exit',function(c){console.log('LSLA closed. '+c.toString());
    process.exit()
});
lslE.on('exit',function(c){console.log('LSLE closed. '+c.toString());
    process.exit()
});
// OpenBCI Preliminary Setup!
var OpenBCIBoard = require('openbci').OpenBCIBoard,
    ourBoard = new OpenBCIBoard({
        verbose:true,
        sntpTimeSync:false
    });

const resyncPeriodMin = 3; // re sync every five(default) minutes
const secondsInMinute = 60;
var sampleRate = 250; // Default to 250, ALWAYS verify with a call to `sampleRate` after `ready` event!
var timeSyncPossible = false;
var sychedFirstTime = false;

var t = 0;
// Call to connect
ourBoard.connect(portName).then(() => {
    ourBoard.on('ready',() => {
        console.log('Board Ready!')
        // Get the sample rate after 'ready' event!
        sampleRate = ourBoard.sampleRate();
        // Find out if you can even time sync, you must be using v2 and this is only accurate after a `.softReset()` call which is called internally on `.connect()`. We parse the `.softReset()` response for the presence of firmware version 2 properties.
        timeSyncPossible = ourBoard.usingVersionTwoFirmware();
        console.log("Time sync possible: (this may be too conservative) "+timeSyncPossible)

        if(dataToWrite.length > 0){
            console.log("Turning Off Channels:");
            for(i = 0; i < dataToWrite.length; i++){
                ourBoard.channelOff(parseInt(dataToWrite[i]))
                    .then(function(){
                        console.log('Turned off a channel!');
                    });
            }
            console.log('Turned Off Channels: ' + dataToWrite);
        }
        console.log("Starting Stream: ");
        ourBoard.streamStart()
            .then(() => {
                console.log("Stream Started. ");
            })
            .catch(err => {
                console.log(`stream start: ${err}`);
            })
    });


    // PTW recommends sample driven  
    ourBoard.on('sample',sample => {
        // Resynchronize every every 5 minutes
        if (synching&(!sychedFirstTime || (sample._count % (sampleRate * resyncPeriodMin * secondsInMinute) === 0))) {
            sychedFirstTime = true;
            console.log('Synching!');
            ourBoard.syncClocksFull()
                .then(syncObj => {
                    // Sync was successful
                    if (syncObj.valid) {
                        // Log the object to check it out!
                        console.log(`Sync Successful! syncObj `,syncObj);

                    // Sync was not successful
                    } else {
                        // Retry it
                        console.log(`Was not able to sync, please retry?`);
                        sychedFirstTime = false;
                    }
                });
        }
        t = ourBoard.time()
        record = true;
        if(waitForSync & synching){
            record = false;
            if (sample.timeStamp) { // true after the first sync
                t = sample.timeStamp;
                record = true;
            }
        }
        if(record){
            tStamp = t;
            st = sample.channelData.join(' ')
            sta = sample.auxData.toString('hex')
            if(st.length>0 && sta.length > 0){
                //getTime returns milliseconds since midnight 1970/01/01
                var se = ''+ tStamp.toString() + ': '+ st +'\n'
                var sa = ''+ tStamp.toString() + ': '+ sta +'\n'
                if(printVals){
                    //console.log('se: '+ se)
                    console.log('sa: '+ sample.auxData.toString('hex'))
                    console.log('Sample sent at t= ' + tStamp.toString());
                }
                lslE.stdin.write(se)
                lslA.stdin.write(sa)
            }
        }
    });
})
.catch(err => {
    console.log(`connect: ${err}`);
});