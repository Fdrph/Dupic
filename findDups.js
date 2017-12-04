const sharp = require('sharp');
const btoa = require('btoa');
const blockhash = require('blockhash');

const SIZE = 256;
var threshold = 1;
var newHashes;
var newDistances;
var currentFolderHashes;
var distances = [];
function IMAGE(path, hash) {
    this.path = path;
    this.hash = hash;
}

process.on('message', (m) => {
    switch (m.message) {
        case 'go':
            threshold = m.threshold;
            generateHashes(m.files);
            break;
        case 'newhashes':
            newHashes = true;
            break;
        default:
            break;
    }

});

function hd(a, b) {
    var count = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
    return count;
}


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
            })
        }
        let temp = files.map(fn);
        let results = await Promise.all(temp);
        currentFolderHashes = results.map((value, i) => { return new IMAGE(files[i], value) });
        newHashes = false;
        newDistances = true;
    }
    
    calculateDistances()
}


function calculateDistances() {
    process.send( { message: 'display-status', status: 'Finding Duplicates...' } );

    if(newDistances) {
        var len = currentFolderHashes.length;
        distances = [];
        for (let i = 0; i < len; i++) {
            for (let j = i+1; j < len; j++) {
                let t = hd(currentFolderHashes[i].hash, currentFolderHashes[j].hash);
                if(t < 12) {
                    distances.push( [t, currentFolderHashes[i].path, currentFolderHashes[j].path] );
                }
            }
        }
        console.log('WE CALCULATED NEW DISTANCES | number of saved: '+ distances.length)
        newDistances = false;
        currentFolderHashes = null;
    }
    findDups();
}

function findDups() {
    console.log("SET DISTANCE "+threshold)
    if (distances.length == 0) { 
        process.send({message: 'final-results', results: []}); 
        return
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
            if (groups[gi].indexOf(i_path) < 0 && temp.indexOf(i_path) < 0) {
                groups[gi].push(i_path);
                temp.push(i_path)
            }
            if (temp.indexOf(j_path) < 0) {
                groups[gi].push(j_path);
                temp.push(j_path)
            }
        }
    }

    groups = groups.filter( (n)=> n.length>1 && n.length<5 )
    process.send( {message: 'final-results', results: groups} )
}

