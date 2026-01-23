# Performs API

```javascript
setSpeed( speed: Number )
```

Changes the speed of the animation player.

- **speed**: New speed. Negative values means playing the animations backwards
<br>
<br>

```javascript
setBackPlaneColor( color: String ) 
```

Changes the color of the scene background.

- **color**: The color in Hex sRGB space
<br>
<br>

```javascript
setBackground( type: Number, image:* String (base64), THREE.Texture or THREE.VideoTexture)
```

Changes the background style. It can be an open space, an studio or a photocall. The studio can have an image or a video in the background. The photocall can have an image/logo that can be repeated.

- **type**: Type of background. The values can be PERFORMS.Backgrounds.OPEN (0), PERFORMS.Backgrounds.STUDIO (1), PERFORMS.Backgrounds.PHOTOCALL (2)

- **image**: _Optional_. The image or the video that has to be on the background.
<br>
<br>

```javascript
setPhotocallOffset( offset: Number )
```

Changes the space between the repeatitive images for the photocall background.

- **offset**: New offset.
<br>
<br>


```javascript
setBackgroundSettings( settings: String )
```

Changes how to fits the image or the video in the studio background based on the passed configuration.

- **settings**: Adjustment of background image or video. The values can be: `"Expand"`, `"Fill"`, `"Extend"` and `"Adjust"`. Default value is `"Expand"`.
<br>
<br>


```javascript
setBackgroundTextureScale( scale: Number )
```

Changes the scale of the image or video for studio background.

- **scale**: New scale. Default value is `1`.
<br>
<br>


```javascript
setBackgroundTexturePosition( position: Array)
```

Changes the position of the image or video for studio background.

- **position**: New position. Default value is center `[0,0]`.
<br>
<br>

```javascript
setConfiguration( configuration: JSON,  callback:* function )
```

**configuration**: JSON with configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.

- **callback**: _Optional_. Function called when all configuration is loaded.
<br>
<br>


```javascript
changeMode( mode: Number )
```

Changes animation player mode. The two modes of Performs are Script (BML,SiGML based instructions) and Keyframe (bvh, bvhe, glb animations).

- **mode**: New mode.`Performs.Modes.SCRIPT` (0) or `Performs.Modes.KEYFRAME` (1). Default is Script mode `0`.
<br>
<br>


```javascript
changeAnimation( animation: String, needsUpdate:* Boolean )
```

- **animation**: Name of a preloaded animation.

- **needsUpdate**: _Optional_. If its true, forces to bound animation to the current character
<br>
<br>


```javascript
changePlayState( play:* Boolean )
```

- **play**: _Optional_. New play state. For Keyframe mode, play/stop current animation. If **play** is `NULL`, switches the current state.
For Script mode, replay the animation from the begining.
<br>
<br>


```javascript
getSpeed(): Number
```

Returns the current speed of the animation player.
<br>
<br>

```javascript
getBackPlaneColor(): String(Hex)
```

Returns the current color of the scene background.
<br>
<br>

```javascript
init( options: JSON)
```

Initializes the application, creates the scene and loads the assets.

- **options**: Configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.
<br>
<br>

```javascript
setConfiguration( options: JSON, callback*: function)
```

Changes the current configuration of the scene based on passed options.

- **options**: Configuration options (position, rotation, scale, animations, autoplay, etc). See [available options](IntegrationGuide.md) for more info.

- **callback**: _Optional_. Function called when changers are completed.
<br>
<br>

```javascript
loadAvatar( avatarURL: String, configFile: File URL or JSON, avatarRotation:* THREE.Quaternion, avatarName: String, callback:* function, onerror:* function)
```

Loads an avatar given a public URL and with a specific configuration for Script animations.

- **avatarURL**: Public URL where the avatar is hosted. Supported extensions are _glb_ and _gltf_.

- **configFile**: Avatar configuration for Script animations (it can be generated through [Atelier](https://atelier.gti.upf.edu/)).

- **avatarRotation**: _Optional_. Avatar rotation. It can be `NULL`.

- **avatarName**: Avatar name.

- **callback**: _Optional_. Function called when loading is completed.

- **onerror**: _Optional_. Function called when the avatar can not be loaded.
<br>
<br>

```javascript
changeAvatar( avatarName: String)
```

Changes the current avatar given the name of a preloaded avatar.

- **avatarName**: Name of the new avatar.
<br>
<br>

```javascript
changeCameraMode( restrictView: Boolean )
```

Changes the camera mode movements.

- **restrictView**: `true` restricts zoom, panning, etc. and `false` lets any camera movement.
<br>
<br>

```javascript
appendCanvasTo( element: HTML element )
```

If there isn't the default GUI, appends as a child the renderer DOM element of Performs (canvas) to the passed element. Useful when custom GUI is added and you want to append Performs into another element. Otherwise, Performs is appended to the HTML body.

- **element**: HTML element to be the parent of Performs' canvas.
<br>
<br>

```javascript
onLoading( text: String )
```

If there isn't the default GUI, it's automatically called when an asset is loaded. Overwrite the function with your code. Useful to make/show custom modals while asset is loading. By default is `NULL`.

- **text**: Text to put in the modal.
<br>
<br>

```javascript
onLoadingEnded( )
```

If there isn't the default GUI, it's automatically called when loading of the asset is completed. Overwrite the function with your code. Useful to remove/hide custom modals. By default is `NULL`.