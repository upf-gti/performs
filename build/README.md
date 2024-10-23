# SignON-realizer embedded code

This code is packed into fewer files for easy integration into other applications.

To embed all the realizer application into your app, you must include the following files and folders:

- [build/index.html](index.html)
- [build/js/](js) --> put the files inside into a folder named "js"
- [data/](/data) --> (EvaHandsEyesFixed.glb and EvaConfig.json are not required if you have internet, otherwise you hace to replace "https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.glb" and "https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.json" for these ones in the App.js)
- [external/](/external) --> (lexgui is not required)

The organisation of folders and files should be as follows:

    project/
        - index.html
        - js/
            - App.js
            - BML.js
            - CharacterController.js
            - IKSolver.js
            - SigmlToBML.js
            - Animation.js

        - data/
            - dictionaries/
            - imgs/
            - animations/

        - external/ 
            - three/
            - es-module-shims.js
            - jquery-3.6.0.min.js
