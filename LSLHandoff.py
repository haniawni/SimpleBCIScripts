"""Reads data from stdin and pours into LSL Stream"""
import sys

name = sys.argv[1]
typeStr = sys.argv[2]
nchan = int(sys.argv[3])
ty = sys.argv[4]



import time
from random import random as rand

from pylsl import StreamInfo, StreamOutlet, local_clock

# first create a new stream info (here we set the name to BioSemi,
# the content-type to EEG, 8 channels, 100 Hz, and float-valued data) The
# last value would be the serial number of the device or some other more or
# less locally unique identifier for the stream as far as available (you
# could also omit it but interrupted connections wouldn't auto-recover).
if (ty == 'f'):
	info = StreamInfo(name, typeStr, nchan, 250, 'float32', '0942579245')
elif(ty == 's'):
	info = StreamInfo(name, typeStr, nchan, 250, 'string', '0942579245')

# append some meta-data
#info.desc().append_child_value("manufacturer", "BioSemi")
#channels = info.desc().append_child("channels")
#for c in ["C3", "C4", "Cz", "FPz", "POz", "CPz", "O1", "O2"]:
#    channels.append_child("channel") \
#        .append_child_value("label", c) \
#        .append_child_value("unit", "microvolts") \
#        .append_child_value("type", "EEG")

# next make an outlet; we set the transmission chunk size to 32 samples and
# the outgoing buffer size to 360 seconds (max.)
outlet = StreamOutlet(info)

#sys.stderr.write("E: now sending data...\n")

while True:
    #Wait for data from LSL
    # Expected format: "[timestamp]: [ch1 val] [ch2 val] [ch3 val] [etc]"

    strSample = sys.stdin.readline().split(': ',1)
    sample = strSample[1].split(' ')
    if (ty == 'f'):
    	sample = list(map(float, sample))
    stamp = float(strSample[0])
    #sys.stderr.write('E: DATA SENT\n')
    # now send it and wait for a bit
    outlet.push_sample(sample, stamp)
    #print('Pushed Sample At: ' + str(stamp))
