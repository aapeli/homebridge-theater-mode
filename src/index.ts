var Service, Characteristic;
import { scan, parseCredentials, NowPlayingInfo, AppleTV, SupportedCommand } from 'node-appletv-x';

export = function(homebridge: any) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-theater-mode', 'AppleTVTheaterMode', AppleTVProgrammableSwitch);
}

class AppleTVProgrammableSwitch {
  private services: any[];
  private switchService: any;
  private playService: any;
  private pauseService: any;
  private stopService: any;

  private device: AppleTV;
  private playbackState: AppleTVProgrammableSwitch.PlaybackState = AppleTVProgrammableSwitch.PlaybackState.Stopped;
  private isEnabled: boolean = false;

  constructor(private log: (string) => void, config: any) {
    let credentials = parseCredentials(config.credentials);
    let that = this;
    scan(credentials.uniqueIdentifier)
      .then(devices => {
        that.device = devices[0];
        that.device.on('error', (error: Error) => {
          that.log(error.message);
          that.log(error.stack);
        });
        return that.device.openConnection(credentials);
      })
      .then(device => {
        log("Opened connection to " + config.name);
      })
      .catch(error => {
        that.log(error);
      });
  }

  private isPlaying(): boolean {
    return this.playbackState == AppleTVProgrammableSwitch.PlaybackState.Playing;
  }

  private isPaused(): boolean {
    return this.playbackState == AppleTVProgrammableSwitch.PlaybackState.Paused;
  }

  private isStopped(): boolean {
    return this.playbackState == AppleTVProgrammableSwitch.PlaybackState.Stopped;
  }

  private setEnabled(value: boolean) {
    this.log("Setting theater mode enabled to " + value);
    this.isEnabled = value;

    if (value) {
      let that = this;
      this.device.on('supportedCommands', (commands: SupportedCommand[]) => {
        if (commands.length == 0 && (that.isPlaying() || that.isPaused())) {
          that.triggerStop();
        }
      })
      .on('nowPlaying', (info: NowPlayingInfo) => {
        if (info == null) {
          return;
        }

        let stateIsPlaying = info.playbackState == NowPlayingInfo.State.Playing;
        let stateIsPaused = info.playbackState == NowPlayingInfo.State.Paused;
        if (stateIsPlaying && !that.isPlaying()) {
          that.triggerPlay();
        } else if (stateIsPaused && that.isPlaying()) {
          that.triggerPause();
        }
      });
    } else {
      this.device.removeAllListeners('nowPlaying');
      this.device.removeAllListeners('supportedCommands');
    }
  }

  identify(callback: () => void) {
    this.log('Identify requested!');
    callback();
  }

  getServices(): any[] {
    if (this.services != null) {
      return this.services;
    }

    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Apple')
      .setCharacteristic(Characteristic.Model, 'Apple TV')
      .setCharacteristic(Characteristic.SerialNumber, '00000000');

    this.switchService = new Service.Switch("Theater Mode", "Theater Mode");
    let that = this;
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('get', callback => {
        callback(null, that.isEnabled);
      })
      .on('set', (value, callback) => {
        that.setEnabled(value);
        callback();
      });

    this.playService = new Service.StatelessProgrammableSwitch("Play", "Play");
    this.playService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setProps({ maxValue: 0 });
    this.playService
      .getCharacteristic(Characteristic.ServiceLabelIndex)
      .setValue(1);

    this.pauseService = new Service.StatelessProgrammableSwitch("Pause", "Pause");
    this.pauseService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setProps({ maxValue: 0 });
    this.pauseService
      .getCharacteristic(Characteristic.ServiceLabelIndex)
      .setValue(2);

    this.stopService = new Service.StatelessProgrammableSwitch("Stop", "Stop");
    this.stopService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setProps({ maxValue: 0 });
    this.stopService
      .getCharacteristic(Characteristic.ServiceLabelIndex)
      .setValue(3);

    this.services = [
      informationService,
      this.switchService,
      this.playService,
      this.pauseService,
      this.stopService
    ];

    return this.services;
  }

  private triggerPlay() {
    if (!this.isEnabled) { return; }
    this.log("Triggering Play Switch Event");
    this.playbackState = AppleTVProgrammableSwitch.PlaybackState.Playing;
    this.playService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setValue(0);
  }

  private triggerPause() {
    if (!this.isEnabled) { return; }
    this.log("Triggering Pause Switch Event");
    this.playbackState = AppleTVProgrammableSwitch.PlaybackState.Paused;
    this.pauseService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setValue(0);
  }

  private triggerStop() {
    if (!this.isEnabled) { return; }
    this.log("Triggering Stop Switch Event");
    this.playbackState = AppleTVProgrammableSwitch.PlaybackState.Stopped;
    this.stopService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setValue(0);
  }
}

module AppleTVProgrammableSwitch {
  export enum PlaybackState {
    Playing = "playing",
    Paused = "paused",
    Stopped = "stopped"
  }
}
