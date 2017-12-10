const sharp = require('sharp');
const blockhash = require('blockhash');
const uri2path = require('file-uri-to-path');
const path = require('path');
const fs = require('fs');
const trash = require('trash');

sharp.cache(false);

const SIZE = 256;
var threshold = 1;
var newHashes = true;
var currentFolderHashes = [];
var distances = [];
function IMAGE(path, hash) {
    this.path = path;
    this.hash = hash;
}

// Receives and deals with messages from main process
process.on('message', (m) => {
    switch (m.message) {
        case 'go':
            threshold = m.threshold;
            generateHashes(m.files);
            break;
        case 'newhashes':
            newHashes = true;
            break;
        case 'delete-selected':
            deleteSelected(m.paths);
        default:
            break;
    }
});

// Calculate hamming distance between a and b
function hd(a, b) {
    var count = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
    return count;
}

// Generates hashes for all the files in the folders given and stores the results in currentFolderHashes
async function generateHashes(files) {

    if (newHashes) {
        process.send( { message: 'display-status', status: 'Generating Hashes...' } );

        function fn(f) {
            var image = sharp(f);
            return image.metadata().then((metadata) => {
                return { w: metadata.width, h: metadata.height }
            }).then((info) => {
                return image.resize(SIZE, SIZE, { interpolator: sharp.interpolator.bilinear })
                    .raw().toBuffer().then((buff) => { return blockhash.blockhashData({ width: SIZE, height: SIZE, data: buff }, 16, 1) })
            }).catch((reason)=>{console.log(reason)})
        }
        let temp = files.map(fn);
        let results = await Promise.all(temp);
        currentFolderHashes = results.map((value, i) => { return new IMAGE(files[i], value) });
    }
    calculateDistances()
}

// Runs after generateHashes, analyses currentFolderHashes and makes N^2 / 2 comparisons, storing only the matches 
// that have a hamming distance less than 11 in an array of arrays called distances
// [ [distance, i_path, J_path] , ...]
function calculateDistances() {
    process.send( { message: 'display-status', status: 'Finding Duplicates...' } );

    if (newHashes) {
        var len = currentFolderHashes.length;
        distances = [];
        for (let i = 0; i < len; i++) {
            for (let j = i+1; j < len; j++) {
                let t = hd(currentFolderHashes[i].hash, currentFolderHashes[j].hash);
                if(t < 11) {
                    distances.push( [t, currentFolderHashes[i].path, currentFolderHashes[j].path] );
                }
            }
        }
        
        newHashes = false;
        currentFolderHashes = null;
    }
    findDups();
}

// Filters the array distances, with the given threshold(strict or relaxed)
// Stores the results in a different format, an array of arrays, with each subarray representing a "group"
// A group is made of similar images, which when displayed becomes a row on the table
// Sends the results to be displayed to the main process, which sends it to the renderer
function findDups() {
    // console.log("SET DISTANCE "+threshold)
    if (distances.length == 0) { 
        process.send({message: 'final-results', results: []}); 
        return;
    }

    var groups = [[]]
    var temp = []
    var gi = 0;
    var current_ipath = distances[0][1];
    for (var i = 0; i < distances.length; i++) 
    {
        var i_path = distances[i][1];
        if(current_ipath != i_path) {current_ipath = i_path; gi++}
        if(distances[i][0] < threshold) {
            if (!groups[gi]) { groups[gi] = [] }
            j_path = distances[i][2];
            if (!groups[gi].includes(i_path) && !temp.includes(i_path)) {
                groups[gi].push(i_path);
                temp.push(i_path)
            }
            if (!temp.includes(j_path)) {
                groups[gi].push(j_path);
                temp.push(j_path)
            }
        }
    }

    groups = groups.filter( (n)=>  n.length>1 && n.length<5  )
    process.send( {message: 'final-results', results: groups} )
}

// Receives an array of paths to delete, deletes them from the computer and
// removes them from the array of stored duplicates (called distances)
function deleteSelected(paths) {
    paths = paths.map((value, i) => { return uri2path(value) })
    
    for (let i = 0; i < paths.length; i++) {
        try { fs.unlinkSync(paths[i]) } catch(error) {console.log(error)}
    }

    distances = distances.filter(function(value) {
        i_path = path.normalize(value[1]);
        j_path = path.normalize(value[2]);
        return !paths.includes(i_path) && !paths.includes(j_path)
    })

}