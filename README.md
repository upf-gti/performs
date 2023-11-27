# Performs


<img src="./data/imgs/performs.png" height="200" align="right">

Performs aims at synthesising the different BML instructions related to both Manual Features (MF) and Non Manual Features (NMF) into animations.

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
    lexeme: "NMF_ARCH"
}
```


## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Acknowledgments
We would like to thank the [Three.js](https://threejs.org/) library for providing the 3D animation capabilities in this tool.
