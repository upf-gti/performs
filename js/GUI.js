import * as THREE from "three"
import { LX } from 'lexgui';
import 'lexgui/components/codeeditor.js';
import { App } from './App.js'

class AppGUI {
    constructor( app ){
        this.app = app;
        this.randomSignAmount = 0;
        
        // available model models paths - [model, config, rotation]
        this.avatarOptions = {
            "Eva": ['/3Dcharacters/Eva/Eva.glb', '/3Dcharacters/Eva/Eva.json', 0, '/3Dcharacters/Eva/Eva.png'],
            "EvaLow": ['/3Dcharacters/Eva_Low/Eva_Low.glb', '/3Dcharacters/Eva_Low/Eva_Low.json', 0, '/3Dcharacters/Eva_Low/Eva_Low.png'],
            "Witch": ['/3Dcharacters/Eva_Witch/Eva_Witch.glb', '/3Dcharacters/Eva_Witch/Eva_Witch.json', 0, '/3Dcharacters/Eva_Witch/Eva_Witch.png'],
            "Kevin": ['/3Dcharacters/Kevin/Kevin.glb', '/3Dcharacters/Kevin/Kevin.json', 0, '/3Dcharacters/Kevin/Kevin.png'],
            "Ada": ['/3Dcharacters/Ada/Ada.glb', '/3Dcharacters/Ada/Ada.json',0, '/3Dcharacters/Ada/Ada.png']
        }

        // take canvas from dom, detach from dom, attach to lexgui 
        this.app.renderer.domElement.remove(); // removes from dom
        let main_area = LX.init();
        main_area.attach( this.app.renderer.domElement );

        main_area.root.ondrop = (e) => {
			e.preventDefault();
			e.stopPropagation();

			this.app.loadFiles(e.dataTransfer.files, () => this.gui.refresh());      
        };

        this.bmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText: "" };
        this.sigmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText:"" };
        this.glossInputData = { openButton: null, dialog: null, textArea: null,  glosses: "" };

        this.gui = null;

        // sessionStorage: only for this domain and this tab. Memory is kept during reload (button), reload (link) and F5. New tabs will not know of this memory
        // localStorage: only for this domain. New tabs will see that memory
        if ( window.sessionStorage ){
            let text;
            text = window.sessionStorage.getItem( "msg" );
            this.app.bmlApp.msg = text ? JSON.parse( text ) : null;
            text = window.sessionStorage.getItem( "bmlInput" ); 
            this.bmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "sigmlInput" ); 
            this.sigmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "glossInput" ); 
            this.glossInputData.glosses = text ? text : "";
            
            window.addEventListener("beforeunload", (event) => {
                // event.returnValue = "\\o/";
                window.sessionStorage.setItem( "msg", JSON.stringify(this.app.bmlApp.msg) );
                if( this.bmlInputData && this.bmlInputData.codeObj ){
                    window.sessionStorage.setItem( "bmlInput", this.bmlInputData.codeObj.getText() );
                }
                if( this.sigmlInputData && this.sigmlInputData.codeObj ){
                    window.sessionStorage.setItem( "sigmlInput", this.sigmlInputData.codeObj.getText() );
                }
                if( this.glossInputData && this.glossInputData.glosses ){
                    window.sessionStorage.setItem( "glossInput", this.glossInputData.glosses );
                }
            });

            window.addEventListener("keyup", (event) => {
                if(event.key == " ") {
                    if(this.app.mode == App.Modes.KEYFRAME && this.keyframeGui) {
                        this.app.keyframeApp.changePlayState();
                        this.keyframeGui.refresh();
                    }
                    else if (this.app.mode == App.Modes.SCRIPT && this.bmlGui) {
                        this.app.bmlApp.replay();
                        this.bmlGui.refresh();
                    }
                }
            });
        }

        this.createPanel();
    }

    refresh(){
        this.gui.refresh();
    }

    createPanel(){

        let pocketDialog = new LX.PocketDialog( "Controls", p => {
            this.gui = p;

            this.gui.refresh = () =>{
                this.gui.clear();
                // // --------- Customization ---------
                p.branch( "Customization", { icon: "fa-solid fa-palette"} );
                // get color set on the actual objects and set them as default values to the colorpicker
                let color = new THREE.Color();

                let chroma = this.app.scene.getObjectByName("Chroma");
                if ( chroma ){
                    color.copy(chroma.material.color);
                    let backPlaneColor = "#" + color.getHexString();
                    p.addColor("Color Chroma", backPlaneColor, (value, event) => {
                        this.app.scene.getObjectByName("Chroma").material.color.set(value); // css works in sRGB
                    });
                }
            
                let modelShirt = this.app.currentCharacter.model.getObjectByName("Tops");
                if ( modelShirt ){
                    color.copy(this.app.currentCharacter.model.getObjectByName("Tops").material.color);
                    let topsColor = "#" + color.getHexString();
        
                    p.addColor("Color Clothes", topsColor, (value, event) => {
                        this.app.scene.getObjectByName("Tops").material.color.set(value); // css works in sRGB
                    });
                }

                p.sameLine();
                let avatars = [];
                for(let avatar in this.avatarOptions) {
                    avatars.push({ value: avatar, src: this.avatarOptions[avatar][3] ?? "data/imgs/monster.png"});
                }
                p.addDropdown("Avatar", avatars, this.app.currentCharacter.model.name, (value, event) => {
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.bmlGui.setValue( "Mood", "Neutral" );  
                    }
                    
                    // upload model
                    if (value == "Upload Avatar") {
                        this.uploadAvatar((value) => {
                            
                            if ( !this.app.loadedCharacters[value] ) {
                                $('#loading').fadeIn(); //hide();
                                let modelFilePath = this.avatarOptions[value][0]; 
                                let configFilePath = this.avatarOptions[value][1]; 
                                let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                                this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                                    this.app.changeAvatar(value);
                                    $('#loading').fadeOut();
                                } );
                                return;
                            } 

                            // use controller if it has been already loaded in the past
                            this.app.changeAvatar(value);

                        });
                    }
                    else {
                        // load desired model
                        if ( !this.app.loadedCharacters[value] ) {
                            $('#loading').fadeIn(); //hide();
                            let modelFilePath = this.avatarOptions[value][0]; 
                            let configFilePath = this.avatarOptions[value][1]; 
                            let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                            this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                                this.app.changeAvatar(value);
                                $('#loading').fadeOut();
                            } );
                            return;
                        } 

                        // use controller if it has been already loaded in the past
                        this.app.changeAvatar(value);
                    }
                });

                p.addButton( null, "Upload Avatar", (v) => {
                    this.uploadAvatar((value) => {
                            
                        if ( !this.app.loadedCharacters[value] ) {
                            $('#loading').fadeIn(); //hide();
                            let modelFilePath = this.avatarOptions[value][0]; 
                            let configFilePath = this.avatarOptions[value][1]; 
                            let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                            this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                                this.app.changeAvatar(value);
                                $('#loading').fadeOut();
                            } );
                            return;
                        } 

                        // use controller if it has been already loaded in the past
                        this.app.changeAvatar(value);

                    });
                } ,{ width: "40px", icon: "fa-solid fa-cloud-arrow-up" } );
                
                p.endLine();

                p.branch( "Recording", { icon: "fa-solid fa-video"} );

                let cameras = [];
                for (let i = 0; i < this.app.cameras.length; i++) {
                    const camera = {
                        value: (i + 1).toString(),
                        callback: (v,e) => {
                            this.app.controls[this.app.camera].enabled = false; // disable controls from previous camera
                            this.app.camera = v - 1; // update active camera
                            this.app.controls[this.app.camera].enabled = true; // enable controls from current (new) camera
                        }
                    }

                    cameras.push(camera);                  
                }

                p.sameLine();
                p.addComboButtons("Camera", cameras, {selected: (this.app.camera + 1).toString(), width: "70%"});     
                p.addComboButtons(null, [
                    {
                        value: "Restricted View",
                        icon: "fa-solid fa-camera",
                        callback: (v, e) => {
                            this.app.toggleCameraMode(); 
                            this.refresh();
                        }
                    },
                    {
                        value: "Free View",
                        icon: "fa-solid fa-up-down-left-right",
                        callback: (v, e) => {
                            this.app.toggleCameraMode(); 
                            this.refresh();
                        }
                    }
                ], {selected: this.app.cameraMode ? "Free View" : "Restricted View"});
                p.endLine("left");

                p.addButton("Capture", this.app.animationRecorder.isRecording ? "Stop recording" : "Start recording", (value, event) => {
                    // Replay animation
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.replay(); 
                    }
                    else {
                        this.app.keyframeApp.changePlayState(true);
                    }
                    this.app.animationRecorder.manageCapture();
                    this.refresh();
                }, {icon: "fa-solid fa-circle", buttonClass: "recording-button" + (this.app.animationRecorder.isRecording ? "-playing" : "")});
                p.merge(); // random signs

                p.branch("Animation", {icon: "fa-solid fa-hands-asl-interpreting"});
                p.addComboButtons("Animation from", [
                    {
                        value: "BML",
                        callback: (v, e) => {
                            this.app.changeMode(App.Modes.SCRIPT);
                            this.refresh();
                        }
                    },
                    {
                        value: "File",
                        callback: (v, e) => {
                            this.app.changeMode(App.Modes.KEYFRAME);
                            this.refresh();
                        }
                    }
                ], {selected: this.app.mode == App.Modes.SCRIPT ? "BML" : "File"});
                
                
                p.addNumber("Signing Speed", this.app.speed, (value, event) => {
                    // this.app.speed = Math.pow( Math.E, (value - 1) );
                    this.app.speed = value;
                }, { min: 0, max: 2, step: 0.01});
                

                if(this.app.mode == App.Modes.SCRIPT) {
                    this.createBMLPanel(p);
                }
                else {
                    this.createKeyframePanel(p);
                }
                p.merge();
            }

            this.gui.refresh();           

        }, { size: ["20%", null], float: "left", draggable: false });
        
        
        if ( window.innerWidth < window.innerHeight || pocketDialog.title.offsetWidth > (0.21*window.innerWidth) ){
            pocketDialog.title.click();
        }

    }

    createBMLPanel(panel) {
        
        this.bmlGui = panel;

        this.bmlGui.sameLine();
        this.bmlGui.addButton( null, "Reset pose", (value, event) =>{
            this.bmlGui.setValue( "Mood", "Neutral" ); 
            this.app.bmlApp.ECAcontroller.reset();
        }, {icon: "fa-solid fa-rotate-left", width: "40px"});

        this.bmlGui.addButton( null, "Replay", (value, event) =>{
            this.app.bmlApp.replay();             
        }, {icon: "fa-solid fa-play"});

        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlInputData.openButton = this.bmlGui.addButton( null, "BML Input", (value, event) =>{

            if ( this.bmlInputData.dialog ){ this.bmlInputData.dialog.close(); }

            this.bmlInputData.dialog = new LX.PocketDialog( "BML Instruction", p => {
                this.bmlInputData.dialog = p;

                let htmlStr = "Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                p.addButton(null, "Click here to see BML instructions and attributes", () => {
                    window.open("https://github.com/upf-gti/performs/blob/main/docs/InstructionsBML.md");
                });
    
                htmlStr = "Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed.";
                htmlStr += "\n\nNote: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                htmlStr = 'An example: { "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }';
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                const area = new LX.Area({ height: "59%" });
                p.attach( area.root );
    
                let editor = new LX.CodeEditor(area, {
                    highlight: 'JSON',
                    skip_info: true,
                    allow_add_scripts: false, 
                    name : "BML"
                });
                editor.setText( this.bmlInputData.prevInstanceText );
                this.bmlInputData.codeObj = editor;

                p.addButton(null, "Send", () => {
                    let msg = {
                        type: "behaviours",
                        data: this._stringToBML( this.bmlInputData.codeObj.getText() )
                    };
                    
                    if ( !msg.data.length ){ return; }

                    this.app.bmlApp.processMessageRawBlocks( [{type: "bml", data: msg}] );
                });

                p.addButton(null, "Edit on Animics", () => {

                    const sendData = () => {
                        if(!this.animics.app.global) 
                        {
                            setTimeout(sendData, 1000)
                        }
                        else {
                            if(!this.animics.app.global.app) {

                                this.animics.app.global.createApp({mode:"bml"});
                                this.animics.app.global.app.editor.realizer = window;
                                this.animics.app.global.app.editor.performsApp = this.app;
                            }

                            let msg = {
                                type: "behaviours",
                                data: this._stringToBML( this.bmlInputData.codeObj.getText() )
                            };
                            
                            //Send to ANIMICS
                            if(this.animics.app.global.app.editor.activeTimeline)
                                this.animics.app.global.app.editor.clearAllTracks(false);
                            this.animics.app.global.app.editor.gui.loadBMLClip({behaviours: msg.data});
                            
                        }
                    }
                    if(!this.animics || this.animics.closed) {
                        this.animics = window.open("https://webglstudio.org/projects/signon/animics");
                        
                        this.animics.onload = (e, d) => {
                            this.animics.app = e.currentTarget;
                            sendData();
                        }
                        this.animics.addEventListener("beforeunload", () => {
                            this.animics = null;
                        });
                    }
                    else {
                        sendData();
                    }
                })
    
            }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true, onclose: (root)=>{
                this.bmlInputData.prevInstanceText = this.bmlInputData.codeObj.getText();
                this.bmlInputData.dialog = null;
                this.bmlInputData.codeObj = null;
                root.remove();
            }});
    
        });

        this.sigmlInputData.openButton = this.bmlGui.addButton( null, "SiGML Input", (value, event) =>{

            if ( this.sigmlInputData.dialog ){ 
                this.sigmlInputData.prevInstanceText = this.sigmlInputData.codeObj.getText();
                this.sigmlInputData.dialog.close(); 
            }

            this.sigmlInputData.dialog = new LX.PocketDialog( "SiGML Instruction", p => {
                let htmlStr = "Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});       
    
                const area = new LX.Area({ height: "85%" });
                p.attach( area.root );
    
                let editor = new LX.CodeEditor(area, {
                    highlight: 'XML',
                    skip_info: true,
                    allow_add_scripts: false, 
                    name : "XML"
                });
                editor.setText( this.sigmlInputData.prevInstanceText );
                this.sigmlInputData.codeObj = editor;
    
                p.addButton(null, "Send", () => {
                    let text = this.sigmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
                    this.app.bmlApp.processMessageRawBlocks( [ {type:"sigml", data: text } ] );
                });
    
            }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true});
        

        });

        let languages = Object.keys(this.app.bmlApp.languageDictionaries);
        let glossesDictionary = {};
        this.language = languages[0];

        for(let i = 0; i < languages.length; i++) {
            let lang = languages[i];
            glossesDictionary[lang] = [];
            for(let glossa in this.app.bmlApp.languageDictionaries[lang].glosses) {
                glossesDictionary[lang].push(glossa.replaceAll(".sigml", ""));
            }
        }
        this.glossInputData.openButton = this.bmlGui.addButton( null, "Glosses Input", (value, event) =>{

            if ( this.glossInputData.dialog ){ this.glossInputData.dialog.close(); }

            this.glossInputData.dialog = new LX.PocketDialog( "Glosses Input", p => {
                p.refresh = () => {
                    p.clear();
                    let htmlStr = "Select or write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                    
                    const area = new LX.Area({ height: "85%" });
                    p.attach( area.root );
                    
                    p.addDropdown("Language", languages, this.app.bmlApp.selectedLanguage, (value, event) => {
                        this.app.bmlApp.selectedLanguage = value;
                        p.refresh();
                    } );

                    p.addDropdown("Select glosses", glossesDictionary[ this.language ], "", (value, event) => {
                        this.glossInputData.glosses += " " + value;
                        this.glossInputData.textArea.set( this.glossInputData.glosses );
                    }, {filter: true});
                    
                    this.glossInputData.textArea = p.addTextArea("Write glosses", this.glossInputData.glosses, (value, event) => {
                        this.glossInputData.glosses = value;
                    }, {placeholder: "Hallo Leuk"});

                    p.addButton(null, "Send", () => {
        
                        let glosses = this.glossInputData.glosses.replaceAll( "\n", " ").split( " " );
                        for ( let i = 0; i < glosses.length; ++i ){
                            if ( typeof( glosses[i] ) != "string" || glosses[i].length < 1 ){ 
                                glosses.splice( i, 1 ); 
                                --i; 
                                continue; 
                            }
                            glosses[i] = { type: "glossName", data: glosses[i].toUpperCase() };
                        }
                        if(!glosses.length) alert("Please, write or select at least one gloss");
                        this.app.bmlApp.processMessageRawBlocks(glosses);    
                    });
                }
                p.refresh();
            }, { closable: true } );
        
        });
        
        this.bmlGui.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], "Neutral", (value, event) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: 1, start: 0.0, shift: true } ] };
            this.app.bmlApp.ECAcontroller.processMsg(JSON.stringify(msg));
        });

        //this.bmlGui.branch( "Random signs" );
        this.bmlGui.sameLine();
        this.bmlGui.addNumber("Random Signs", this.randomSignAmount, (v,e)=>{this.randomSignAmount = v;}, { min:0, max:100, slider: false, icon:"fa-solid fa-dice" } );
        this.bmlGui.addButton( null, "Play random signs", (v,e)=>{ 
            if (!this.randomSignAmount ){ return; }
            let k = Object.keys( this.app.bmlApp.languageDictionaries[this.app.bmlApp.selectedLanguage]["glosses"] );
            
            let m = [];
            for( let i = 0; i < this.randomSignAmount; ++i ){
                m.push( { type: "glossName", data: k[ Math.floor( Math.random() * (k.length-1) ) ] } );
            }
            console.log( JSON.parse(JSON.stringify(m)));
            this.app.bmlApp.processMessageRawBlocks( m );
        }, { width: "40px", icon: "fa-solid fa-share"} );
        this.bmlGui.endLine();
        this.bmlGui.merge(); // random signs
        
              
    }

    createKeyframePanel(panel) {
      
        this.keyframeGui = panel;
  
        this.keyframeGui.sameLine();
        this.keyframeGui.addDropdown("Animation", Object.keys(this.app.keyframeApp.loadedAnimations), this.app.keyframeApp.currentAnimation, (v) => {
            this.app.keyframeApp.onChangeAnimation(v);
        });

        this.keyframeGui.addButton("", "<i class='fa fa-solid " + (this.app.keyframeApp.playing ? "fa-stop'>": "fa-play'>") + "</i>", (v,e) => {
            this.app.keyframeApp.changePlayState();
            this.keyframeGui.refresh();
        }, { width: "40px"});
        this.keyframeGui.endLine(); 
    }
    
    uploadAvatar(callback = null) {
        let name, model, config;
        let rotation = 0;

        this.avatarDialog = new LX.Dialog("Upload Avatar", panel => {

            panel.addText("Name Your Avatar", undefined, (v, e) => {
                if (this.avatarOptions[v]) LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]});
                name = v;
            });

            panel.addFile("Avatar File", (v, e) => {
                let extension = panel.widgets["Avatar File"].domEl.children[1].files[0].name.split(".")[1];
                if (extension == "glb" || extension == "gltf") { model = v; }
                else { LX.popup("Only accepts GLB and GLTF formats!"); }
            }, {type: "url"});
            
            panel.addFile("Config File", (v) => {
                let extension = panel.widgets["Config File"].domEl.children[1].files[0].name.split(".")[1];
                if (extension == "json") { config = JSON.parse(v); }
                else { LX.popup("Config file must be a JSON!"); }
            }, {type: "text"});
            
            panel.addNumber("Apply Rotation", 0, (v) => {
                rotation = v * Math.PI / 180;
            }, { min: -180, max: 180, step: 1 } );
            
            panel.sameLine(2);
            panel.addButton(null, "Create Config File", () => {
                window.open("https://webglstudio.org/projects/signon/performs-atelier", '_blank').focus();
            })
            panel.addButton(null, "Upload", () => {
                if (name && model && config) {
                    if (this.avatarOptions[name]) { LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]}); return; }
                    this.avatarOptions[name] = [model, config, rotation, "data/imgs/monster.png"];
                    
                    panel.clear();
                    this.avatarDialog.root.remove();
                    if (callback) callback(name);
                }
                else {
                    LX.popup("Complete all fields!", null, { position: ["45%", "20%"]});
                }
            });

        }, { size: ["40%"], closable: true, onclose: (root) => { root.remove(); this.gui.setValue("Avatar File", this.app.currentCharacter.model.name)} });

        return name;
    }

    setBMLInputText( text ){
        this.bmlInputData.prevInstanceText = text;
        if ( this.bmlInputData.codeObj ){ this.bmlInputData.codeObj.setText( text ); }
    }

    _stringToBML( str ){
        // let text = this.bmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
        let result = [];
        let text = str.replaceAll("\n", "").replaceAll("\r", "");
        let parseSuccess = false;
        // JSON
        try {
            result = JSON.parse( text );
            parseSuccess = true;
        } catch (error ) { parseSuccess = false; }
        if ( !parseSuccess ){
            try{ 
                result = JSON.parse( "[" + text + "]" );
            }
            catch( error ){
                alert( "Invalid bml message. Check for errors such as proper quoting (\") of words or commas after each instruction (except the last one) and attribute." );
                return [];
            }       
        }

        if ( !Array.isArray( result ) ){
                if ( Array.isArray( result.behaviours ) ){ result = result.behaviours; }
                else{ result = [ result ]; }
        } 

        // for mouthing, find those words that need to be translated into phonemes (ARPA)
        for( let i = 0; i < result.length; ++i ){
            if ( result[i].type == "speech" && typeof( result[i].text ) == "string" ){
                let strSplit = result[i].text.split( "%" ); // words in NGT are between "%"
                let resultSpeechtext = "";
                for( let j = 0; j < strSplit.length; ){
                    resultSpeechtext += strSplit[j]; // everything before are phonemes
                    j++;
                    if ( j < ( strSplit.length - 1 ) ){ // word to translate
                        resultSpeechtext += this.app.wordsToArpa( strSplit[j], "NGT" );
                    }
                    j++;
                }
                result[i].text = resultSpeechtext + ".";
            }
        }

        return result;
    }
}

export { AppGUI };