import fs from 'fs';
import { postComparison } from '@percy/sdk-utils';
import Driver from './driverResolver/driver.js';
import CommonMetaDataResolver from './metadata/commonMetaDataResolver.js';
import { PercyClient } from '@percy/client';
import fetch from 'node-fetch';
import crypto from 'crypto';

function sha256hash(content) {
  return crypto
    .createHash('sha256')
    .update(content, 'utf-8')
    .digest('hex');
}

class Tile {
  constructor({
    filepath,
    statusBarHeight,
    navBarHeight,
    headerHeight,
    footerHeight,
    fullscreen,
    sha
  }) {
    this.filepath = filepath;
    this.statusBarHeight = statusBarHeight;
    this.navBarHeight = navBarHeight;
    this.headerHeight = headerHeight;
    this.footerHeight = footerHeight;
    this.fullscreen = fullscreen;
    this.sha = sha;
  }
}

export default class PoaDriver {
  sessionId = '';
  commandExecutorUrl = '';
  capabilities = {};
  driver = null;
  driver2 = null;
  constructor(
    sessionId,
    commandExecutorUrl,
    capabilities,
    snapshotName,
    sessionCapabilites,
    buildId
  ) {
    this.sessionId = sessionId;
    this.commandExecutorUrl = commandExecutorUrl;
    this.capabilities = capabilities;
    this.snapshotName = snapshotName;
    this.sessionCapabilites = sessionCapabilites;
    this.buildId = buildId;
    this.metaData = {};
    this.createDriver2();
    // this.takeScreenshot();
    this.overlayScreenshot();
  }

  async createDriver2() {
    this.driver2 = new Driver(this.sessionId, this.commandExecutorUrl);
    const caps = await this.driver2.helper.getCapabilites();
    console.log(caps);
    this.commonMetaData = await CommonMetaDataResolver.resolve(this.driver2, caps.value, this.capabilities);
  }

  async takeScreenshot() {
    await this.localScreenshot();
  }

  async overlayScreenshot() {
    let img = await this.contextualScreenshot();
    img = img.image;
    const fileName1 = `./outScreenshot_${this.snapshotName}_merged.png`;
    fs.writeFileSync(fileName1, img, { encoding: 'base64' });
    this.triggerAppPercy();
  }

  async contextualScreenshot() {
    const fileName = `./outScreenshot_${this.snapshotName}.png`;
    await this.driver2.helper.takeScreenshot().then(
      function(image, err) {
        fs.writeFileSync(fileName, image, { encoding: 'base64' });
      }
    );
    const command = {
      domData: await this.collectDomData(),
      name: this.snapshotName,
      image: fs.readFileSync(fileName, { encoding: 'base64' })
    };
    this.dom_sha = sha256hash(JSON.stringify(command.domData));
    fs.writeFileSync(`${fileName}_domsha.json`, JSON.stringify(command.domData));
    const client = new PercyClient({ token: process.env.PERCY_TOKEN });
    console.log(this.buildId);
    console.log('above is buildId');
    const x = await client.uploadResource(
      this.buildId,
      { filepath: `${fileName}_domsha.json` }
    );
    console.log(x);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(command)
    };
    const baseUrl = 'http://127.0.0.1:5000/overlay';
    const response = await fetch(baseUrl, options);
    const img = await response.json();
    return img;
  }

  async localScreenshot() {
    // const metaObj = new MetaDataResolver();
    // this.metaData = await metaObj.resolve(this.capabilities);
    const fileName = `./outScreenshot_${this.snapshotName}.png`;
    this.driver.takeScreenshot().then(
      function(image, err) {
        fs.writeFile(fileName, image, 'base64', function(err) {
          console.log(err);
        });
      }
    ).then(() => {
      this.triggerAppPercy();
    });
  }

  async triggerAppPercy() {
    // const app = new AppiumDriver(this.driver);
    this.percyScreenshot(this.snapshotName);
  }

  async collectDomData() {
    const script = fs.readFileSync('collectDomData.txt', { encoding: 'utf8' });
    const data = await this.driver2.helper.executeScript({ script: script, args: [] });
    return data.value;
  }

  async getTag() {
    const { width, height } = await this.metaData.screenSize();
    const orientation = (await this.metaData.orientation());
    return {
      name: await this.metaData.deviceName() || 'unknown',
      osName: await this.metaData.osName() || 'unknown',
      osVersion: await this.metaData.osVersion(),
      width,
      height,
      orientation: orientation
    };
  }

  async getTag1() {
    const { width, height } = await this.commonMetaData.windowSize();
    const orientation = (await this.commonMetaData.orientation());
    return {
      name: await this.commonMetaData.deviceName() || 'unknown',
      osName: await this.commonMetaData.osName() || 'unknown',
      osVersion: await this.commonMetaData.osVersion(),
      width,
      height,
      orientation: orientation
    };
  }

  getTiles() {
    // const path = `./outScreenshot_${this.snapshotName}.png`;
    const path = `./outScreenshot_${this.snapshotName}_merged.png`;
    const fullscreen = false;
    return [
      new Tile({
        filepath: path,
        statusBarHeight: 0,
        navBarHeight: 0,
        headerHeight: 0,
        footerHeight: 0,
        fullscreen
      })
    ];
  }

  async percyScreenshot(name) {
    const tag = await this.getTag1();
    console.log(tag);
    const tiles = this.getTiles();
    const eUrl = 'https://localhost/v1';
    return await postComparison({
      name,
      tag,
      tiles,
      externalDebugUrl: eUrl,
      environmentInfo: 'staging-poc-poa',
      clientInfo: 'local-poc-poa',
      domSha: this.dom_sha
    });
  }
}
