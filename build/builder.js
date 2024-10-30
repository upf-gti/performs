let fs = require('fs');
let path = require('path');

/** ScriptApp.js includes: 
 * - ./js/bml/BehaviourManager.js
 * - ./js/bml/BehaviourPlanner.js
 * - ./js/bml/BehaviourRealizer.js 
 * 
 *  - ./js/sigml/Extfidir.js
 *  - ./js/sigml/HandShape.js
 *  - ./js/sigml/LocationArmIK.js
 *  - ./js/sigml/Motion.js
 *  - ./js/sigml/Palmor.js
 *  - ./js/sigml/sigmlUtils.js
 *  - ./js/sigml/BodyController.js 
 *  - ./js/sigml/GeometricArmIK.js (IKSolver)
 *  - ./js/sigml/SigmlToBML.js
 * 
 *  - ./js/controllers/CharacterController.js
 *  - ./js/controllers/FacialController.js
 * 
 * */

/** KeyframeApp.js includes:
 *  - ./js/extendedBVHLoader.js
 *  - ./js/retargeting/retargeting.js
 */

// /** CharacterController.js includes:
//  * - ./js/controllers/CharacterController.js
//  * - ./js/controllers/FacialController.js
//  * - ./js/sigml/BodyController.js 
//  * */

// /** IKSolver.js --> Same as IKSolver.js */

// /** SigmlToBML.js --> Same as SigmlToBML.js */

function build() {
    
    let files = {
        "ScriptApp.js": [
            "../js/sigml/Utils.js",
            "../js/bml/BehaviourManager.js",
            "../js/bml/BehaviourPlanner.js", 
            "../js/bml/BehaviourRealizer.js", 
            "../js/sigml/HandShape.js",
            "../js/sigml/ExtfidirPalmor.js",
            "../js/sigml/LocationBodyArm.js",
            "../js/sigml/HandConstellation.js",
            "../js/sigml/Motion.js",
            "../js/sigml/ElbowShouldersBodyNMF.js",

            "../js/controllers/CharacterController.js",
            "../js/controllers/FacialController.js",
            "../js/sigml/BodyController.js",
            "../js/sigml/GeometricArmIK.js",
            "../js/sigml/SigmlToBML.js",
            "../js/ScriptApp.js",
        ],
        "KeyframeApp.js": [
            "../js/extendedBVHLoader.js",
            "../js/retargeting/retargeting.js",
            "../js/KeyframeApp.js",
        ],
        // "CharacterController.js": [
        //     "../js/controllers/CharacterController.js",
        //     "../js/controllers/FacialController.js",
        //     "../js/sigml/BodyController.js",
        // ],
        // "IKSolver.js" : ["../js/sigml/GeometricArmIK.js"],
        // "SigmlToBML.js": [ "../js/sigml/SigmlToBML.js"],
        "App.js": [
            // "../js/ScriptApp.js",
            // "../js/KeyframeApp.js",
            "../js/recorder/recorder.js",
            "../js/App.js"
        ],
        // "Animation.js": [
        //     "../js/extendedBVHLoader.js",
        //     "../js/retargeting/retargeting.js"
        // ]
    };
    
    //change import files of classes
    
    let toWrite = {};
    let toImport = {};
    let toExport = {};

    for(let filename in files) {
        
        readFiles(files[filename], 
            (data, imports, exports) => {
                
                toImport[filename] = imports;
                toExport[filename] = exports;
                toWrite[filename] = data;
            },
            (err) => {
                
                if (err) console.log(err);    
               
            },
        )
    }
    
    let filenames = Object.values(files);
    let newFilenames = Object.keys(files);

    for(let filename in files) {
        let newPaths = {};
        let imports = toImport[filename];
        let exports = toExport[filename];
        let importedClasses = [];
        for(let oldPath in imports) {
            
            let classes = imports[oldPath];
            let isExported = false;
            for(let i = 0; i < classes.length; i++) {
                if(exports.indexOf(classes[i])>-1 && classes[i] !='BVHLoader' || importedClasses.indexOf(classes[i]) >-1)
                    isExported = true;
            }

            if(isExported)
                continue;
            let newPath = oldPath;
            if(!oldPath.includes("three")) 
            {
                let p =  oldPath.split("/"); 
                p = p[p.length-1];
     
                let idx = filenames.findIndex(x => {
                    let a = x.map( f => {
                        let a = f.split("/");
                        return a[a.length-1];
                    })
    
                    return a.indexOf(p) > -1 ;       
                });
                newPath = newFilenames[idx];
            }
            if(newPath == undefined)
                continue;
            if(newPaths[newPath])
                newPaths[newPath] = [...newPaths[newPath], ...classes];
            else
                newPaths[newPath] = classes;
              
            let temp = [];
            for (let i = 0; i < newPaths[newPath].length; i++) {
                if ( !temp.includes( newPaths[newPath][i] ) ){
                    temp.push( newPaths[newPath][i] );
                }
            }
            newPaths[newPath] = temp;
            importedClasses = [...importedClasses, ...temp];
        }
        let data = "";
        for(let newPath in newPaths) {

            let classes = newPaths[newPath].join(", ");
            if(!classes.includes("*")) {
                classes = "{ " + classes + " }";
            }
            if(!newPath.includes("three"))
                newPath = "./" + newPath;
           data += "import " + classes + " from '" + newPath + "';\n";
           
        }
        data += toWrite[filename];
        data += "export { " + exports.join(", ") + "} \n";
        filename = './js/' + filename;
        function ensureDirectoryExistence(filePath) {
            var dirname = path.dirname(filePath);
            if (fs.existsSync(dirname)) {
              return true;
            }
            ensureDirectoryExistence(dirname);
            fs.mkdirSync(dirname);
          }
        ensureDirectoryExistence(filename);

        fs.writeFile(filename, data, (err) => {
            if (err) console.log(err);
            console.log("Successfully Written to ", filename);
        });
        }
}

function readFiles(filenames, onFileContent, onError) {
 
    let globals = [];
    let imports = {};
    let exports = [];
    let contentFile = ""; //"(function(global){\n";
    let files = filenames.map((x) => {let a = x.split("."); return a[a.length-2]});
    for(let i = 0; i < filenames.length; i++) {
        let filename = filenames[i];
        let content = fs.readFileSync(filename, 'utf-8');
        // if(filename.includes("extendedBVH")) {
        //     contentFile = content;
        //     continue;
        // }
        let newContent = "";
        content.split(/\r?\n/).forEach(line =>  {
            if(line.includes("import "))
            {

                line = line.replace("import ", "");
                let oldPath = line.split("from ")[1];
                line = line.replace("from " + oldPath, "");
                oldPath = oldPath.replaceAll(/[\'\"\;]/g, "");

                let str = "";
                if(line.includes("*")) {
                    str = [line];
                }
                else {

                    str = line.split("{")[1];
                    str = str.split("}")[0];
                    str = str.replaceAll(" ", "");
                    str = str.split(",");
                }
                if(imports[oldPath] != undefined) {
                    
                    for(let j = 0; j < str.length; j++) {
                        
                        if(imports[oldPath].indexOf(str[j]) < 0)
                            imports[oldPath].push(str[j]);
                    }
                }
                else {
                    imports[oldPath] = str;
                }
            }
            else if(line.includes("export ")) {
               
                let classes = line.replace("export ", "").replace("{", "").replace("}", "").replace(";", "");
                classes = classes.replaceAll(" ","").split(",");
                exports = [...exports, ...classes]
            }
            else if(line.slice(0,3) == 'let' ) {
                let global = line.split("=")[0];
                let includes = globals.map( x => {
                    
                    return line.includes(x)
                });

                if(includes.indexOf(true)>-1) {
                }else {
                    globals.push(global);
                    newContent += line + "\r";
                }
            }
            else
                newContent += line + "\r";
          });
        contentFile += 
        // "/** \n"+
        // "* @class "+ context + "\n*/ " +
        newContent + "\n"         
    }

    onFileContent(contentFile, imports, exports);

}

build();