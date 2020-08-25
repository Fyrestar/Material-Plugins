# Chainable onBeforeCompile & Material Plugins
Makes `onBeforeCompile` of materials chainable rather than just one callback being possible. Enables per-mesh individual uniforms instead just global without core changes. Both features don't violate the API when integrating and fix cases where a material needs multiple patches but `onBeforeCompile` gets overwritten.

So you can do the following with both callbacks being called before compiling is done:

```javascript
material.onBeforeCompile = function( shader ) { ... };
material.onBeforeCompile = function( shader ) { ... };
```

**Demo**
https://codepen.io/Fyrestar/pen/BXYGgN 23

**Demo: Simple waving grass plugin**
https://codepen.io/Fyrestar/pen/PMyZpR 13

![Grass](https://aws1.discourse-cdn.com/standard17/uploads/threejs/original/2X/0/0750e7c58e6ed590255a08621a0ad3b9c21c4d74.gif)

## Material Callbacks for per-mesh or per-material uniforms

When extending shaders with `onBeforeCompile` it only gives you acces to the uniforms once. Material callbacks allow you to not only use uniforms per material again (on in-built materials) but also per object, like in this example:
https://codepen.io/Fyrestar/pen/ymjqMm 13

So you can extend materials in a plugin pattern and pass properties of meshes or materials to the shader.

Where you store per-mesh properties is up to you, you can either use the mesh directly like in the example (might be less optimal), store it in it’s userData object, or extend the mesh class (optimal).

### Usage

Call `THREE.MaterialCallback.use();` at the beginning of your app to apply it to the prototype of Mesh and SkinnedMesh, if you want it manually or need `onBeforeRender` yourself, just call within your callback: `THREE.MaterialCallback.call( this, renderer, scene, ... )`

Since `onBeforeRender` is calling a empty function by default anyway this won't add more overhead, being on the prototype just 1 object shared globally.

**If you use post-processing or otherwise call renderer.render() more than once per frame set `THREE.MaterialCallback.auto = false;` and call `THREE.MaterialCallback.frame();` whenever your actual app loop starts.**


For the actual callback where you pass the property stored in a mesh or material instance to the program you create a `onBeforeCompile` callback with an object instead a function that contains the callbacks.

 - **frame** is called every frame (notice the bold paragraph above in order for this being every app frame rather than render call)
 - **render** is called before a mesh is rendered, here you update the uniforms
 - **compile** is the regular onBeforeCompile callback

```javascript
const GrassPlugin = {
    time: 0,
    frame: function() {

        this.time += 0.025;

    },
    render: function( object, uniforms, context ) {

        context.set( uniforms.uTime, this.time );
        context.set( uniforms.uSize, object.waveLength );

    },
    compile: function( shader ) {

        shader.uniforms.uSize = {
            value: 0
        };
        shader.uniforms.uTime = {
            value: 0
        };

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            'vec3 normal = normalize( vNormal );'
        );
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `
                #include <common>
                
                #ifndef uTime
                uniform float uTime;
                #endif
                
                uniform float uSize;
                
                float rand(float n){return fract(sin(n) * 43758.5453123);}
                
                float noise(float p){
                float fl = floor(p);
                float fc = fract(p);
                return mix(rand(fl), rand(fl + 1.0), fc);
                }
                
                float noise(vec2 n) {
                const vec2 d = vec2(0.0, 1.0);
                vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
                return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
                }

        `);

        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
            #include <beginnormal_vertex>
            objectNormal = vec3(0.0, 1.0, 0.0);
        
        `);
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
            
            vec4 GRASS_world = modelMatrix * vec4( transformed, 1.0 );
            transformed.xz += uv.y * ( noise(GRASS_world.xz + uTime ) * uSize );
            
            #include <project_vertex>
        `);

    }
};
```
