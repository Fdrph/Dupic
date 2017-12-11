const {remote, ipcRenderer, shell} = require('electron')
const {BrowserWindow} = remote
const fs = require('fs')
const sharp = require('sharp')

const CurrentWindow = remote.getCurrentWindow()


ipcRenderer.on('print', (ev, m)=>{ console.log(m) });

const units = ['bytes', 'KB', 'MB']
function niceBytes(x) {
	let l = 0, n = parseInt(x, 10) || 0;
	while (n >= 1024) {
		n = n / 1024;
		l++;
	}
	return (n.toFixed(n >= 10 || l < 1 ? 0 : 1) + ' ' + units[l]);
}

// ------------------------------ TOP HEADER ------------------------------------
var close = document.getElementById('close')
var minimize = document.getElementById('minimize')
var maximize = document.getElementById('maximize')
if(process.platform == "darwin") {
	close.innerHTML = "X";
	document.body.style.fontFamily = "sans-serif";
	document.body.style.font = "normal";
}
close.addEventListener('click', ()=>{ CurrentWindow.close()} );
minimize.addEventListener('click', ()=>{ CurrentWindow.minimize()} );
maximize.addEventListener('click', ()=>{
	CurrentWindow.isMaximized() ? CurrentWindow.unmaximize() : CurrentWindow.maximize()
});

// ------------------------------ CONTROL BAR -----------------------------------
// Folder Icon: Add folder
document.getElementById('set-folder').addEventListener('click', setFolderMainProcess );
function setFolderMainProcess() {
	ipcRenderer.send('asynchronous-message', 'setworkingfolder');
}

// Set bar to display path user chose
ipcRenderer.on('current-path', (event, path)=>{ document.getElementById('current-path').innerHTML = path });

// Slider that selects how strict or relaxed the algorithm should be
var slider = document.getElementById("slider-1");

// Open help window
document.getElementById('help').addEventListener('click', () => { ipcRenderer.send('asynchronous-message', 'openhelp')})

// Go Button
document.getElementById('go-button').addEventListener('click', goButton);
function goButton() {
	document.getElementById('image-table').innerHTML = "";
	var v = document.getElementById('slider-1').value;
	ipcRenderer.send('asynchronous-message', 'go', v);
}

// Delete-Selected button, sends an array with the images to delete to the main process,
// which sends it to the child process which deletes them
document.getElementById('delete-selected').addEventListener('click', deleteSelected);
function deleteSelected() {

	if (!confirm("Are you sure you want to delete these images?")) { return }

	var toDelete = [];
	let imgTable = document.getElementById('image-table');
	for (let i = 0; row = imgTable.rows[i]; i++) 
	{
		for (let j = 0; cell = row.cells[j]; j++) 
		{
			let div = cell.firstChild;
			if (div.hasChildNodes() && div.lastChild.id == 'deletion-cross') {
				let path = div.firstChild.src;
				toDelete.push(path);
				div.innerHTML = "Deleted...";
			}
		}
	}
	ipcRenderer.send('asynchronous-message', 'delete-selected', 0, toDelete);
}


// ---------------------------------- Image Table ----------------------------------
ipcRenderer.on('final-dups', (event, groups) => {
	if(groups.length != 0) {
		addRow(groups)
		displayStatus('', "Done")
	} else {
		displayStatus('', "Nothing Found")
	}
});

// Display all duplicate images on the left pane table of images
function addRow(groups) {
	let tableRef = document.getElementById('image-table');
	// console.log(groups)

	for (let row of groups) 
	{
		var newRow = tableRef.insertRow(-1);
		for(let image of row) 
		{	
			try { fs.accessSync(image) } catch (error) { break }
			var newcell = newRow.insertCell(-1); 
			var img = document.createElement('img');
			var div = document.createElement('div');
			img.src = image;
			div.style.position = "relative"; 
			div.appendChild(img);
			addeventlisteners(div, img);
			newcell.appendChild(div);
		}
	}
}

function addeventlisteners(div, img) {
	
	// Left click
	img.addEventListener('click', async function (ev) {
		let imgpath = decodeURI( img.src.substr(8) );
		if(process.platform == 'darwin') {imgpath = "/"+imgpath}
		let size = niceBytes( fs.statSync(imgpath).size );
		let meta = await sharp(imgpath).metadata();

		// Display image in viewer
		let t = document.getElementById('image-container');
		if(t.childElementCount>1) { t.removeChild(t.lastChild) }
		document.getElementById('image-display').src = img.src;

		// Display image path size and resolution
		document.getElementById('path-display').innerHTML = imgpath;
		document.getElementById('size').innerHTML = size;
		document.getElementById('resolution').innerHTML = meta.width+" x "+meta.height;
	});

	// Right click: Add deletion cross
	img.addEventListener('contextmenu', function (ev) {
		ev.preventDefault();
		if(div.childElementCount<2) {
			let cross = document.createElement('img');
			cross.src = "./assets/cross.svg"; 
			cross.id = 'deletion-cross';
			div.appendChild(cross);
		} else {div.removeChild(div.lastChild)}
		return false;
	}, false);

}

// ------------------------------ Right Image Display ------------------------------
// Mark for deletion button
document.getElementById('mark').addEventListener('click', markForDeletion);
function markForDeletion() {
	var rightClick = new CustomEvent('contextmenu');
	var imageToMark = displayedImg.src;
	var table = document.getElementById('image-table');
	for (let row of table.rows) 
	{
		for (let cell of row.cells) 
		{
			let img = cell.firstChild.firstChild;
			if(img.src == imageToMark) { img.dispatchEvent(rightClick) }
		}
	}
}

// Show item in folder
let displayedImg = document.getElementById('image-display');
document.getElementById('locate-disk').addEventListener('click', ()=>{
	remote.shell.showItemInFolder(displayedImg.src)
})

// Display status of the algorithm
ipcRenderer.on('current-status', displayStatus)
function displayStatus(ev, message) {
	document.getElementById('image-display').src = "";
	let t = document.getElementById('image-container');
	if (t.childElementCount == 1) {
		let div = document.createElement('div');
		t.appendChild(div);
	}
	t.lastChild.innerHTML = message;
}


