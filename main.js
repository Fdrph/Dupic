// app: Module to control application life.
// BrowserWindow: Module to create native browser window.
const {app, BrowserWindow, dialog, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const glob = require("glob")
const cp = require('child_process')


const child = cp.fork( `${__dirname}/findDups.js`)


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let helpWindow;

// createWindow method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

function createWindow () {

    // Create the browser window.
    mainWindow = new BrowserWindow(
      {
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        backgroundColor: '#2e2c29',
        frame: false
      })
    
    // and load the index.html of the app.
    mainWindow.loadURL( url.format(
    {
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }))

    mainWindow.on('closed', () => { mainWindow=null; child.kill()})

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

}

function openHelpWindow() {
    if(helpWindow == null) {    
        helpWindow = new BrowserWindow(
            {
                width: 960,
                height: 600,
                resizable: false,
                parent: mainWindow,
                backgroundColor: '#2e2c29',
                frame: false
            })
        helpWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'help.html'),
            protocol: 'file:',
            slashes: true
        }))
        helpWindow.show();
        helpWindow.on('closed', () => { helpWindow=null })
    }
}

// child process to main process communications
child.on('message', (m) => {
    switch (m.message) {
        case 'final-results':
            mainWindow.webContents.send('final-dups', m.results);
            break;
        case 'display-status':
            mainWindow.webContents.send('current-status', m.status)
            break;
        default:
            console.log("ERROR::CHILD_TO_MAIN::NO_OPTION_FOUND")
            break;
    }
})

// renderer to main process communications
ipcMain.on('asynchronous-message', dealWithEvents)
function dealWithEvents(event, type, threshold, paths) {
    switch (type) 
    {
        case 'setworkingfolder':
            getDirectories();
            break;
        case 'go':
            getFileList(threshold);
            break;
        case 'delete-selected':
            child.send({message: 'delete-selected', paths: paths})
            break;
        case 'openhelp':
            openHelpWindow();
        default:
            console.log("ERROR::RENDERER_TO_MAIN::NO_OPTION_FOUND")
            break;
    }
}

var ACTIVE_DIRS = "";
function getDirectories() {

    let directories = dialog.showOpenDialog({ properties: ['openDirectory','multiSelections'] })
    // sendToConsole(directories)
    if (directories == null) { return }
    ACTIVE_DIRS = directories;
    
    child.send({ message: 'newhashes'})
    mainWindow.webContents.send('current-path', ACTIVE_DIRS);
}

function getFileList(threshold) {
    
    var len = ACTIVE_DIRS.length;
    if (len != 0) 
    {
        var files = [];
        for (let i = 0; i < len; i++) {
            var current_dir = ACTIVE_DIRS[i];
            let curr = glob.sync("**/*.+(webp|WEBP|jpg|JPG|jpeg|JPEG|png|PNG|tif|TIF|tiff|TIFF)", { cwd: current_dir })
            curr = curr.map((value, i)=>{ return path.normalize( path.join(current_dir, value) )})
            files = files.concat(curr);
        }
        // console.log(files);
        child.send({ message: 'go', files: files, threshold: threshold });

    } else { dialog.showMessageBox({ message: "You must select a path before you start!" }) }
}



function sendToConsole(arg) { mainWindow.webContents.send('print', arg) }
