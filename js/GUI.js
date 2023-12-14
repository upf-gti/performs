import * as THREE from "three"
import { LX } from 'lexgui';
import 'lexgui/components/codeeditor.js';


class AppGUI{
    constructor( app ){
        this.app = app;
        this.randomSignAmount = 0;
        
        // available model models paths - [model, config, rotation]
        this.avatarOptions = {
            "Eva": ['./data/EvaHandsEyesFixed.glb', './data/EvaConfig.json', -Math.PI/2],
            "EvaLow": ['/3Dcharacters/Eva_Low/Eva_Low.glb', '/3Dcharacters/Eva_Low/Eva_Low.json', -Math.PI/2],
            "Ada": ['/3Dcharacters/Ada/Ada.glb', '/3Dcharacters/Ada/Ada.json', 0],
        }

        // take canvas from dom, detach from dom, attach to lexgui 
        this.app.renderer.domElement.remove(); // removes from dom
        let main_area = LX.init();
        main_area.attach( this.app.renderer.domElement );

        this.bmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText: "" };
        this.sigmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText:"" };
        this.glossInputData = { openButton: null, dialog: null, textArea: null,  glosses: "" };

        this.gui = null;
        
        // sessionStorage: only for this domain and this tab. Memory is kept during reload (button), reload (link) and F5. New tabs will not know of this memory
        // localStorage: only for this domain. New tabs will see that memory
        if ( window.sessionStorage ){
            let text;
            text = window.sessionStorage.getItem( "msg" );
            this.app.msg = text ? JSON.parse( text ) : null;
            text = window.sessionStorage.getItem( "bmlInput" ); 
            this.bmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "sigmlInput" ); 
            this.sigmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "glossInput" ); 
            this.glossInputData.glosses = text ? text : "";
            
            window.addEventListener("beforeunload", (event) => {
                // event.returnValue = "\\o/";
                window.sessionStorage.setItem( "msg", JSON.stringify(this.app.msg) );
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
                // p.branch( "Customization" );
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
            
                let modelShirt = this.app.model.getObjectByName("Tops");
                if ( modelShirt ){
                    color.copy(this.app.model.getObjectByName("Tops").material.color);
                    let topsColor = "#" + color.getHexString();
        
                    p.addColor("Color Clothes", topsColor, (value, event) => {
                        this.app.scene.getObjectByName("Tops").material.color.set(value); // css works in sRGB
                    });
                }

                p.addNumber("Signing Speed", this.app.signingSpeed, (value, event) => {
                    // this.app.signingSpeed = Math.pow( Math.E, (value - 1) );
                    this.app.signingSpeed = value;
                }, { min: 0, max: 2, step: 0.01});
                
                p.addButton( null, "Replay", (value, event) =>{
                    this.app.ECAcontroller.processMsg( JSON.parse( JSON.stringify(this.app.msg) ) ); 
                });

                p.addButton( null, "Reset Pose", (value, event) =>{
                    this.gui.setValue( "Mood", "Neutral" ); 
                    this.app.ECAcontroller.reset();
                });
                
                this.bmlInputData.openButton = p.addButton( null, "BML Input", (value, event) =>{

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

                            this.app.msg = JSON.parse(JSON.stringify(msg)); // copy object
                            this.app.ECAcontroller.processMsg( msg );
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

                this.sigmlInputData.openButton = p.addButton( null, "SiGML Input", (value, event) =>{

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
                            highlight: 'xml',
                            skip_info: true,
                            allow_add_scripts: false, 
                            name : "XML"
                        });
                        editor.setText( this.sigmlInputData.prevInstanceText );
                        this.sigmlInputData.codeObj = editor;
            
                        p.addButton(null, "Send", () => {
                            let text = this.sigmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
                            this.app.processMessageRawBlocks( [ {type:"sigml", data: text } ] );
                        });
            
                    }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true});
                

                });

                let languages = Object.keys(this.app.languageDictionaries);
                let glossesDictionary = {};
                this.language = languages[0];

                for(let i = 0; i < languages.length; i++) {
                    let lang = languages[i];
                    glossesDictionary[lang] = [];
                    for(let glossa in this.app.languageDictionaries[lang].glosses) {
                        glossesDictionary[lang].push(glossa.replaceAll(".sigml", ""));
                    }
                }
                this.glossInputData.openButton = p.addButton( null, "Glosses Input", (value, event) =>{

                    if ( this.glossInputData.dialog ){ this.glossInputData.dialog.close(); }

                    this.glossInputData.dialog = new LX.PocketDialog( "Glosses Input", p => {
                        p.refresh = () => {
                            p.clear();
                            let htmlStr = "Select or write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                            p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                            
                            const area = new LX.Area({ height: "85%" });
                            p.attach( area.root );
                            
                            p.addDropdown("Language", languages, this.app.selectedLanguage, (value, event) => {
                                this.app.selectedLanguage = value;
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
                                    glosses[i] = glosses[i].toUpperCase();
                                }
                                if(!glosses.length) alert("Please, write or select at least one gloss");
                                this.app.processMessage( { IntermediateRepresentation: { glosses: glosses } } );    
                            });
                        }
                        p.refresh();
                    }, { closable: true } );
                
                });
                
                p.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], "Neutral", (value, event) => {
                    let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: 1, start: 0.0, shift: true } ] };
                    this.app.ECAcontroller.processMsg(JSON.stringify(msg));
                });

                p.addDropdown("Avatar", Object.keys( this.avatarOptions ), this.app.model.name, (value, event) => {
                    this.gui.setValue( "Mood", "Neutral" );  
                    
                    // load desired model
                    if ( !this.app.controllers[value] ) {
                        $('#loading').fadeIn(); //hide();
                        let modelFilePath = this.avatarOptions[value][0]; let configFilePath = this.avatarOptions[value][1]; let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                        this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                            this.app.changeAvatar(value);
                            $('#loading').fadeOut();
                        } );
                        return;
                    } 

                    // use controller if it has been already loaded in the past
                    this.app.changeAvatar(value);
                });

                p.addButton( null, this.app.cameraMode ? "Restricted View" : "Free View", (v,e)=>{ this.app.toggleCameraMode(); this.refresh(); } );

                p.branch( "Random signs", {closed: true} );
                p.addButton( "Send", "send", (v,e)=>{ 
                    if (!this.randomSignAmount ){ return; }
                    let k = Object.keys( this.app.languageDictionaries[this.app.selectedLanguage]["glosses"] );
                    
                    let m = [];
                    for( let i = 0; i < this.randomSignAmount; ++i ){
                        m.push( { type: "glossName", data: k[ Math.floor( Math.random() * (k.length-1) ) ] } );
                    }
                    console.log( JSON.parse(JSON.stringify(m)));
                    this.app.processMessageRawBlocks( m );
                } );
                p.addNumber("amount", this.randomSignAmount, (v,e)=>{this.randomSignAmount = v;}, { min:0, max:100 } );
                p.merge(); // random signs

                p.branch( "SL demo" );
                p.addDropdown("Language", [ "SLE", "LSC", "ISL", "BSL", "NGT", "VGT" ], "SLE", (value, event) => {
                });
                p.addNumber("sheen", 0, (v,e)=>{
                    this.app.model.traverse( (ob) => {
                        if(ob.material)
                            ob.material.sheen = v;
                    });
                }, { min:0, step:0.01, max:1 } );
                p.addNumber("exposure", this.app.renderer.toneMappingExposure, (v, e) => {
                    this.app.renderer.toneMappingExposure = v;
                }, { min:0, step:0.01, max:3 } );
                p.addDropdown("tonemap", [ "Linear", "Filmic" ], "Linear", (v, e) => {
                    switch(v){
                        case "Linear":
                            this.app.renderer.toneMapping = THREE.LinearToneMapping;
                            break;
                        case "Filmic":
                            this.app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                            break;
                    }
                });
                p.merge(); // SL demo
            }

            this.gui.refresh();
            // p.merge(); // end of customization

        }, { size: ["20%", null], float:"left", draggable:false });
        
        if ( window.innerWidth < window.innerHeight || pocketDialog.title.offsetWidth > (0.21*window.innerWidth) ){
            pocketDialog.title.click();
        }

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

