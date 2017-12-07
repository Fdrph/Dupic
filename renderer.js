const {remote, ipcRenderer, shell} = require('electron')
const {BrowserWindow} = remote
const fs = require('fs')
var sharp = require('sharp')

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
document.getElementById('close').addEventListener('click', ()=>{ CurrentWindow.close()} );
document.getElementById('minimize').addEventListener('click', ()=>{ CurrentWindow.minimize()} );
document.getElementById('maximize').addEventListener('click', ()=>{
	CurrentWindow.isMaximized() ? CurrentWindow.unmaximize() : CurrentWindow.maximize()
});

// ------------------------------ CONTROL BAR -----------------------------------
document.getElementById('set-folder').addEventListener('click', setFolderMainProcess );
function setFolderMainProcess() {
	ipcRenderer.send('asynchronous-message', 'setworkingfolder');
}

// Set bar to display path user chose
ipcRenderer.on('current-path', (event, path)=>{ document.getElementById('current-path').innerHTML = path });

// Slider
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
// Delete Selected
document.getElementById('delete-selected').addEventListener('click', deleteSelected);
function deleteSelected() {
	let imgTable = document.getElementById('image-table');
	for (let i = 0; row = imgTable.rows[i]; i++) 
	{
		for (let j = 0; cell = row.cells[j]; j++) 
		{
			let div = cell.firstChild;
			if (div.hasChildNodes() && div.lastChild.id == 'deletion-cross') { 	
				div.innerHTML = "Deleted...";
			}
		}
	}
}


// ---------------------------------- Image Table ----------------------------------
ipcRenderer.on('final-dups', (event, groups) => {
	if(groups.length != 0) {
		displayStatus('', "Done")
		addRow(groups)
	} else {
		displayStatus('', "Nothing Found")
	}
});

// Display all duplicated found on the left table of images
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
			addeventlisteners(div, img)
			newcell.appendChild(div);
		}
	}
}

function addeventlisteners(div, img) {
	
	img.addEventListener('click', async function (ev) {
		let imgpath = decodeURI(img.src.substr(8));
		let size = niceBytes( fs.statSync(imgpath).size );
		let meta = await sharp(imgpath).metadata();

		// Display image in viewer
		let t = document.getElementById('image-container');
		if(t.childElementCount>1) {t.removeChild(t.lastChild)}
		document.getElementById('image-display').src = img.src;

		// Display image path size and resolution
		document.getElementById('path-display').innerHTML = imgpath;
		document.getElementById('size').innerHTML = size;
		document.getElementById('resolution').innerHTML = meta.width+" x "+meta.height;
	});

	// Add deletion cross on right click
	img.addEventListener('contextmenu', function (ev) {
		ev.preventDefault();
		if(div.childElementCount<2) {
			let cross = document.createElement('img');
			cross.src = "./assets/cross.svg"; cross.id = 'deletion-cross';
			div.appendChild(cross);
		} else {div.removeChild(div.lastChild)}
		return false;
	}, false);

}

// ------------------------------ Right Image Display ------------------------------
let displayedImg = document.getElementById('image-display');
document.getElementById('locate-disk').addEventListener('click', ()=>{
	remote.shell.showItemInFolder(displayedImg.src)
})

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




















// Progress bar
// ipcRenderer.on('progress', progressBar);
// function progressBar(event, total) {
// 	var prog = document.getElementById('ontop'); 
// 	// prog.max = total;
// 	var n = 0;
// 	var id = setInterval(() => {
// 		if(n == total) { clearInterval(id) } else {
// 			n++;
// 			prog.style.width = n + '%';
// 		}
// 	}, 14)
// }