# Performs

<img src="./data/imgs/performs.png" height="200" align="right">

Performs is designed to visualize and synthesize humanoid animations for customized avatars. It supports two types of animations: [**keyframe animations**](#keyframe-animation) (glTF, BVH) and [**script animations**](#script-animation) (SiGML, BML). The second mode integrates a variety of BML (Behavior Markup Language) instructions for Manual Features (MF) and Non-Manual Features (NMF) to create cohesive animations, performed in real-time. The project has made significant progress in synthesizing NMF, which is essential for enhancing the realism of sign language animations. This initiative began as part of the SignON project, a user-centric and community-driven effort aimed at facilitating communication among Deaf, hard of hearing, and hearing individuals across Europe.

![Alt Text](https://iili.io/2BeAGwb.gif)

The application allows users to customize the following features:
- Avatar:
    - [x] Character
    - [x] Cloth color
- Background:
    - [x] Space: _Open space_, _Studio_, _Photocall_
    - [x] Color
    - [x] Photocall image
- Illumination:
    - [x] Light position
    - [x] Light color

It can be easily integrated into other applications by inserting an HTML iframe or by including the js libary.

## Performs as an Iframe
Insert Performs inside your application using the _iframe_ HTML element.
```html
<iframe src='https://performs.gti.upf.edu'>
```
> [!IMPORTANT]  
> You can customize the default settings combining the [available options](./docs/PerformsSettings.md) with multiple parameters by concatenating them with _&_.
>
> So for example showing a custom avatar in a blue chroma would look like that:
>```html
><iframe src='https://performs.gti.upf.edu?avatar=https://models.readyplayer.me/67162be7608ab3c0a85ceb2d.glb&background=studio&color=rgb(54,54,190)'>
>```

## Performs as a library
By default, Performs generates the code for creating a fully functional web application with its built-in GUI. But there are two versions of performs modules: 

<span style="color: rgb(179, 135, 94);">**performs.module.js**</span>: Performs **with** a default GUI. Requires importing [lexgui.js](https://github.com/jxarco/lexgui.js/), [treejs](https://threejs.org/) and include [_style.css_](style.css).

<span style="color: rgb(179, 135, 94);">**performs.nogui.module.js**</span>: Performs **without** GUI. It only requires importing [treejs](https://threejs.org/). If you want to develop your own GUI, see [Performs API](./docs/PerformsAPI.md) for useful functions.

- `index.html`
```html
<!DOCTYPE html>
<html>
    <head>
        <title>My app using Performs</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="icon" type="image/x-icon" href="./data/imgs/favicon.png">
        <link rel="stylesheet" href="https://cdn.skypack.dev/lexgui@0.7.6/build/lexgui.css">
        <link rel="stylesheet" href="./style.css">
        <script async src="https://unpkg.com/es-module-shims@0.10.7/dist/es-module-shims.js"></script>
        <script type="importmap">
			{
				"imports": {
					"three": "../external/three/build/three.module.js",
                    "three/addons/": "../external/three/jsm/",
                    "lexgui": "https://cdn.skypack.dev/lexgui@0.7.10/build/lexgui.module.js",
                    "lexgui/extensions/": "https://cdn.skypack.dev/lexgui@0.7.10/build/extensions/"
				}
			}
		</script>
    </head>
    <body>
        <script type="module" src="main.js"></script>
    </body>
</html>
```
- `main.js`


```javascript
import { Performs } from './performs.module.js';
const performs = new Performs();
const customOptions = {restrictView: false};
performs.init( customOptions );
```

You can load the customization features through the GUI, by loading a JSON file or by appending URL parameters. It can also be passed as a JSON object, calling functions like _init(options)_ and _setConfiguration(options)_. For a complete list of available options, please refer to [Performs Settings](./docs/PerformsSettings.md).

> [!IMPORTANT]  
> To load the default avatar, an internet connection is required. If you prefer to work offline, you can change the _modelToLoad_ in the _init()_ method of _Performs.js_. You can use the resources from the _/data_ folder or add your own.

### Examples
The following sections provide examples of how to initialize the application without a GUI or configure it to initialize with a specific mode as the default. You can also check the demos: **[Demo with default GUI](./build/demo-with-gui.html)** or **[Demo with custom GUI](./build/demo-without-gui.html)**.

### <span style="color:rgb(151, 54, 190)">Keyframe animation</span>
This mode visualizes clip animations across different avatars. To ensure effective retargeting, certain options need to be adjusted for the _source_ animation and the _target_ avatar:
- _Embedded transforms_: Retargeting only takes into account the transforms from the actual bone objects (local transforms). If set to true, external (parent) transforms are computed and embedded into the root joint (only once, on construction). Afterwards, parent transforms/matrices can be safely modified and will not affect in retargeting. Useful when it is easier to modify the container of the skeleton rather than the actual skeleton in order to align source and target poses.
    - `true` or `false`
    
- _Reference pose mode_: Determines which pose will be used as the retargeting bind pose.
    - `DEFAULT`: Uses skeleton's actual bind pose
    - `CURRENT`: Uses skeleton's current pose
    - `TPOSE`: Forces the bind pose to be a T-pose and sets _CURRENT_ mode.

A detailed explanation of these options can be found in the [retargeting repository](https://github.com/upf-gti/retargeting-threejs/tree/main?tab=readme-ov-file#constructor).
> [!IMPORTANT]  
> Currently only **.gltf**, **.glb**, **.bvh** and **.bvhe** (bvh extended to support facial intensities) are supported. If you happen to use another format, please convert it to the mentioned formats.


#### Code example
- `main.js`

By default, **Keyframe mode** is enabled. However, if a configuration file for **Script mode** is detected, the mode will automatically switch. When multiple animations are loaded, a crossfade blending is applied during transitions between animations. The blend time can be adjusted using the `blendTime` attribute of `keyframeApp`.

```javascript
import { PERFORMS } from 'performs.module.js'
            
const performs = new PERFORMS.Performs();

// Set customization options
const options = {    
    srcEmbeddedTransforms: true,
    trgEmbeddedTransforms: true,
    srcReferencePose: 0, // DEFAULT
    trgReferencePose: 2, // TPOSE
    autoplay: true,
    animations = [{name: './data/animations/myAnimation.glb', data: null}], // Set keyframe animation files' URL. 'data' can be an already parsed file
    
    onReady = () => { // Function called after loading the application
        // Change to Keyframe mode 
        performs.changeMode(PERFORMS.Modes.KEYFRAME);

        // Play the animation after 1s
        setTimeout(() => performs.changePlayState(true), 1000);
    }
}

// Init performs with the options
performs.init(options);
```

## <span style="color:rgb(151, 54, 190)">Script animation</span>
This mode allows for the generation of procedural animations based on instructions. The system interprets the instructions based in **SiGML** (Signing Gesture Markup Language), and translates them into an extended version of BML (Behavior Markup Language), or directly into BML in **JSON** format. While the results may not match the quality of keyframe animations, this approach requires neither expensive equipment nor extensive manual labor, making it highly suitable for scalable sign synthesis. These instructions can be written manually or generated and exported using [Animics](https://animics.gti.upf.edu)' script mode, which enables the creation and editing of this type of animation through a visual timeline-clip representation.

The current supported instructions are explained in detail in [BML Instructions](./docs/InstructionsBML.md).
An example:
``` javascript
{
    type: "faceLexeme",
    start: 0.1,
    attackPeak: 0.6,
    relax: 1.5,
    end: 1.8,
    amount: 0.1,
    lexeme: "ARCH"
}
```

#### Code example
- `main.js`

Include [`./data/dictionaries/`](./data/dictionaries/) folder in your project to use the Idle animation and the NGT gloss dictionary.

``` javascript
import { PERFORMS } from 'performs.module.js'
            
const performs = new PERFORMS.Performs();

const options = {
    config = './data/configFile.json', // Set required config file for Script mode

    scripts = [ // Set script instruction files' URL and/or parsed data
        {
            type: 'sigml', 
            name: './data/animations/scriptAnimation.sigml'
            },
        {
            type: 'bml', 
            data: {
                behaviours: [{
                    type: "faceLexeme",
                    start: 4,
                    attackPeak: 0.6,
                    relax: 1.5,
                    end: 1.8,
                    amount: 1,
                    lexeme: "ARCH"
                }]
            }
        },
    ],
    applyIdle: true, // Enable Idle animation to blend with recieved instructions
    onReady = () => { // Function called after loading the application
        setTimeout(() => {
            // Play the animation after 1s
            performs.changePlayState(true);
        }, 1000)                    
    }
};

// Init performs with the options
performs.init(options);
```

## Installation and Running
Clone the repository:
```sh
git clone https://github.com/upf-gti/performs.git
```
To run locally, host a server from the main project folder.

To modify the code, you should change the source files and then build it to get the module updated.

To build you must run the following command:

```sh
npm run build
```

> [!IMPORTANT]  
> You may need to install the [rollup package](https://www.npmjs.com/package/rollup).

## Examples
Some examples on simple NGT (Dutch Sign Language) 

Kind lezen boek (child reads a book):

![Alt Text](https://iili.io/2foQwCu.gif) 

Man rijden fiets (Man rides a bicycle) :

![Alt Text](https://iili.io/2foZgS4.gif)

## Adding avatars
> [!IMPORTANT]  
> Currently only **.gltf** and **.glb** are supported. If you happen to use another format, please convert it to the mentioned formats.

To add a new avatar to Performs, you must follow this steps:

 1. Make sure the avatar is rigged (if it is not rigged, we recommend using [Mixamo](https://www.mixamo.com)) 
 2. Check that your avatar has the correct scale and orientation.
 3. Use the [performs-atelier](https://github.com/upf-gti/performs-atelier) tool to configure all the parameters needed for the application (only required for **Script mode**), this will generate a configuration _.json file_ containing all the needed information.

## Collaborators
- Jaume Pozo [@japopra](https://github.com/japopra)  
- Eva Valls [@evallsg](https://github.com/evallsg)
- Carolina del Corral [@carolinadcf](https://github.com/carolinadcf)
- Alex Rodríguez [@jxarco](https://github.com/jxarco)
- Víctor Ubieto [@victorubieto](https://github.com/victorubieto)
- Pablo García [@PZerua](https://github.com/PZerua)

## Acknowledgments

- [Three.js](https://threejs.org/) - An open-source JavaScript library for creating interactive 3D and 2D graphics in web browsers.
- [Lexgui.js](https://github.com/jxarco/lexgui.js/) - A simple and lightweight GUI library for creating graphical user interfaces for web applications.

We would like to extend our gratitude to the creators and maintainers of these libraries for their invaluable contributions to the open-source community.

## Support

This project is being developed with partial financial support of:

| EMERALD Project (2023-2026) | SignON Project (2021-2023) |
| --- | --- |
| ![miciu](./data/imgs/marco_EMERALD.png) | ![logomaxr](./data/imgs/marco_SignON.png) |

