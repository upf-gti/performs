# Integration Guide

## Iframe
Insert Performs inside your application using the _iframe_ HTML element.
```html
<iframe src='https://webglstudio.org/projects/signon/performs'>
```

| Name          | Type   | Description                                             |  
|---------------|--------|---------------------------------------------------------|
|  avatar       | String | Character file URL                                      |
|  config       | String | Configuration file URL                                  |
|  cloth        | String | Top cloth color value                                   |
|  color        | String | Background color                                        |
|  background   | String | _open_, _studio_ or _photocall_. Use _open_ as default  |
|  img          | String | Image file URL for _photocall_                          |
|  offset       | Float  | [0, 1]. Space between images in the photocall.          |
|  light        | String | Light color                                             |
|  lightpos     | String | Direct light position                                   |

> [!IMPORTANT]  
> You can combine multiple parameters by concatenating with &.

### Expected values

#### avatar
URL of a glTF file.

##### Expected values
- https://webglstudio.org/3Dcharacters/ReadyEva/ReadyEva.glb
- https://models.readyplayer.me/67162be7608ab3c0a85ceb2d.glb

>[!IMPORTANT]
> Without any of the optional parameters, the avatar is returned based on default values.

#### config
URL of a JSON file with the configuration provided by [performs-atelier](https://github.com/upf-gti/performs-atelier).

##### Expected values
- https://webglstudio.org/3Dcharacters/ReadyEva/ReadyEva.json

>[!IMPORTANT]
> Without a config file, the Script Mode doesn't work. The default avatars have already had it.