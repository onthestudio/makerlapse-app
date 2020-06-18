const { app, BrowserWindow, ipcMain, shell } = require("electron");

const path = require("path");
const isDev = require("electron-is-dev");
const { capture } = require("./main/takeScreenshot");
const moment = require("moment");
const { menubar } = require("menubar");
const fs = require("fs");
let mainWindow;
let intereval;
let dir = app.getAppPath();
let tray;
let mb;
let webCamWindow = null;
let frameCount = 0;
const {
  createMusicWindow,
  openMusicDialog,
  hideMusicWindow,
} = require("./windows/music");
const { speedUpVideo } = require("./main/videoProcessing");
const { hideVideoWindow, createVideoWindow } = require("./windows/video");
const Store = require("electron-store");

const store = new Store();

const frameRate = store.get("frameRate") || 30;

/*
require("update-electron-app")({
  repo: "kitze/react-electron-example",
  updateInterval: "1 hour",
});

*/
let inputPath;
let time = 0;
let selectedScreenId;
let selectedWindowId;

const now = Date.now();
let folder;

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("ready", () => {
  /*
  setInterval(() => {
    capture((err, res) => {
      if (err) { console.error(err) }
    })
  }, captureDelay)*/

  mb = menubar({
    preloadWindow: true,
    index: isDev
      ? "http://localhost:9000"
      : url.format({
          pathname: path.join(__dirname, "../build/index.html"),
          protocol: "file:",
          slashes: true,
        }),
    browserWindow: {
      width: 290,
      height: 380,
      webPreferences: { nodeIntegration: true },
      maximizable: false,
      title: "Makerlapse",
    },
  });

  mb.on("ready", () => {
    console.log("Ready ...");

    tray = mb.tray;
  });

  const { powerMonitor } = require("electron");
  powerMonitor.on("resume", () => {
    console.log("The system is going to sleep");
    if (webCamWindow !== null) {
      webCamWindow.close();
      createWebcamWindow();
    }
  });
});

ipcMain.on(
  "start-screenshoting",
  (event, { selectedScreen, selectedWindow, selectOption }) => {
    event.returnValue = "Start ScreenShoting";
    frameCount = 0;
    selectedScreenId = selectedScreen;
    selectedWindowId = selectedWindow;
    folder = moment(now).format("YYYY-MM-DD-HH-mm-ss");

    console.log(selectedWindow);
    if (selectOption === "screen-only") {
      intereval = setInterval(() => {
        frameCount += 1;

        showEstimatedTime(frameCount);
        capture(folder, selectedScreen, selectedWindow);
      }, 1000);
    } else {
      createWebcamWindow();

      intereval = setInterval(() => {
        frameCount += 1;
        showEstimatedTime(frameCount);

        capture(folder, selectedScreen, selectedWindow);
      }, 1000);
    }
  }
);

ipcMain.on("stop-screenshoting", (event) => {
  event.returnValue = "Stop ScreenShoting";

  if (webCamWindow !== null) {
    webCamWindow.close();
  }
  clearInterval(intereval);
  inputPath = path.join(dir, folder);

  fs.readdir(inputPath, (error, files) => {
    frameCount = files.length; // return the number of files
    console.log(frameCount, frameRate);
    time = (frameCount / frameRate) * 1000;
    createMusicWindow(inputPath, time);
  });
});

function createWebcamWindow() {
  const { screen } = require("electron");
  let display = screen.getPrimaryDisplay();
  let width = display.bounds.width;
  let height = display.bounds.height;

  webCamWindow = new BrowserWindow({
    height: 200,
    width: 200,
    webPreferences: { nodeIntegration: true },
    maximizable: false,
    icon: path.join(__dirname, "assets/icons/icon.png"),
    title: "Makerlapse",
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    x: width - 200,
    y: height - 210,
  });
  webCamWindow.loadURL(`file://${path.join(__dirname, "webcam.html")}`);
  app.dock.hide();
  webCamWindow.setAlwaysOnTop(true, "floating");
  webCamWindow.setVisibleOnAllWorkspaces(true);
  webCamWindow.fullScreenable = false;
  console.log(webCamWindow.isAlwaysOnTop());

  webCamWindow.on("closed", () => (webCamWindow = null));
}

function showEstimatedTime(frameCount) {
  let time = frameCount / frameRate;
  console.log(frameCount, time);
  var duration = moment
    .utc(moment.duration(time, "seconds").asMilliseconds())
    .format("mm:ss");

  console.log(duration);

  tray.setTitle(duration);
}

ipcMain.on("upload-soudtrack", (event) => {
  openMusicDialog();
  event.returnValue = "Upload Soundtarck";
});

ipcMain.on("skip-music", (e) => {
  e.reply("asynchronous-reply");
  hideMusicWindow();
  createVideoWindow();
  console.log(inputPath, time);
  speedUpVideo(inputPath, time, null);
});

ipcMain.on("play-video", (e, path) => {
  e.reply("asynchronous-reply");
  shell.openItem(path);
});

ipcMain.on("hide-music", (e) => {
  e.reply("asynchronous-reply");
  hideMusicWindow();
});

ipcMain.on("hide-video", (e) => {
  e.reply("asynchronous-reply");
  hideVideoWindow();
});
ipcMain.on("open-video", (e, path) => {
  console.log(path);
  e.reply("asynchronous-reply");
  shell.showItemInFolder(path);
});
ipcMain.on("get-preferences", (e) => {
  e.returnValue = frameRate;
});
ipcMain.on("udpate-preferences", (e, frameRate) => {
  store.set("frameRate", frameRate);
  e.reply(store.get("frameRate"));
});

ipcMain.on("pause-screenshoting", (event) => {
  event.returnValue = "Pause ScreenShoting";
  console.log("Pause Recording");
  clearInterval(intereval);
  webCamWindow.close();
});
ipcMain.on("resume-screenshoting", (event) => {
  event.returnValue = "Resume ScreenShoting";
  createWebcamWindow();
  intereval = setInterval(() => {
    frameCount += 1;

    showEstimatedTime(frameCount);
    capture(folder, selectedScreenId, selectedWindowId);
  }, 1000);
});
