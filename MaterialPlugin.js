// Author: Fyrestar https://mevedia.com (https://github.com/Fyrestar/MaterialPlugin)
(function() {

    let currentObject;

    const context = {
        callbacks: [],
        renderer: null,
        scene: null,
        camera: null,
        material: null,
        geometry: null,
        group: null,
        gl: null,
        set: function( uniform, value ) {

            uniform.setValue( this.gl, value );
            uniforms[ uniform.id ].value = value;

        }
    };



    const Materials = [
        THREE.ShadowMaterial,
        THREE.SpriteMaterial,
        THREE.RawShaderMaterial,
        THREE.ShaderMaterial,
        THREE.PointsMaterial,
        THREE.MeshPhysicalMaterial,
        THREE.MeshStandardMaterial,
        THREE.MeshPhongMaterial,
        THREE.MeshToonMaterial,
        THREE.MeshNormalMaterial,
        THREE.MeshLambertMaterial,
        THREE.MeshDepthMaterial,
        THREE.MeshDistanceMaterial,
        THREE.MeshBasicMaterial,
        THREE.MeshMatcapMaterial,
        THREE.LineDashedMaterial,
        THREE.LineBasicMaterial,
        THREE.Material,
        THREE.MeshFaceMaterial,
        THREE.MultiMaterial,
        THREE.PointCloudMaterial,
        THREE.ParticleBasicMaterial,
        THREE.ParticleSystemMaterial
    ];

    function sortPriority( a, b ) {

        return b.priority - a.priority;

    }



    const onBeforeCompile = {
        get: function() {

            if ( !this._onBeforeCompile.toString ) {

                const self = this;

                this._onBeforeCompile.toString = function() {

                    let code = '';

                    if ( self.plugins ) {

                        for ( let i = 0, l = self.plugins.length; i < l; i ++ ) {

                            const plugin = self.plugins[ i ];

                            code += plugin instanceof Function ? plugin.toString() : plugin.compile.toString();

                        }

                    }

                    return code;

                };

            }

            return this._onBeforeCompile;

        },
        set: function( callback ) {

            if ( callback === null ) {

                if ( this.plugins )
                    while ( this.plugins.length )
                        this.removePlugin( this.plugins[0] );

                this.callbacks = null;

            } else if ( callback instanceof Array ) {

                for ( let i = 0, l = callback.length; i < l; i ++ )
                    this.onBeforeCompile = callback[i];

            } else if ( callback instanceof Function || callback instanceof Object ) {


                const plugin = callback;

                if ( this.hasPlugin( plugin ) )
                    return;

                if ( plugin.requires instanceof Array )
                    this.addPlugin( plugin.requires );

                if ( !this.plugins )
                    this.plugins = [];

                plugin.used = plugin.used || 0;
                plugin.priority = plugin.priority || 0;

                this.plugins.unshift( plugin );
                this.plugins.sort(sortPriority);

                if ( plugin.used === 0 && plugin.frame instanceof Function )
                    context.callbacks.push( plugin );

                plugin.used ++ ;

                if ( plugin.render instanceof Function ) {

                    if ( !this.callbacks )
                        this.callbacks = [];

                    this.callbacks.push( plugin );

                }


            } else {

                console.error('Invalid type "%s" assigned to onBeforeCompile', typeof callback );

            }

        }
    };

    function addPlugin( plugin ) {

        this.onBeforeCompile = plugin;

    }

    function removePlugin( plugin ) {

        if ( plugin.compile instanceof Function ) {

            const index = this.plugins.indexOf( plugin );

            if ( index > -1 )
                this.plugins.splice( index,  1 );

            this.plugins.sort( sortPriority );
        }

        if ( plugin.render instanceof Function ) {

            const index = this.callbacks.indexOf( plugin );

            if ( index > -1 )
                this.callbacks.splice( index,  1 );

        }

        plugin.used -- ;

        if ( plugin.used === 0 && plugin.frame instanceof Function ) {

            const index = context.callbacks.indexOf( plugin );

            if ( index > -1 )
                context.callbacks.splice( index,  1 );

        }

    }

    function hasPlugin( plugin ) {

        return this.plugins ? ( this.plugins.indexOf( plugin ) > -1 ) : false;

    }

    function invalidate() {

        this.defines = this.defines || {};

        this.defines.VERSION = this.version ++ ;
        this.needsUpdate = true;

    }


    for ( let i = 0, l = Materials.length; i < l; i ++ ) {

        const Material = Materials[i];

        if ( Material ) {

            Material.prototype.plugins = null;
            Material.prototype.callbacks = null;
            Material.prototype._onBeforeCompile = function( shader ) {

                if ( this.plugins ) {

                    for ( let i = 0, l = this.plugins.length; i < l; i ++ ) {

                        const plugin = this.plugins[ i ];

                        ( plugin instanceof Function ? plugin : plugin.compile ).call( this, shader, plugin, currentObject );

                    }


                }

            };
            Material.prototype._onBeforeCompile.toString = null;

            Object.assign( Material.prototype, {
                addPlugin,
                removePlugin,
                hasPlugin,
                invalidate,

                version: 1
            });

            const dispose = Material.prototype.disponse;

            Material.prototype.disponse = function() {

                this.onBeforeCompile = null;

                dispose.call( this );

            };


            Object.defineProperty( Material.prototype, 'onBeforeCompile', onBeforeCompile );

        }


    }


    // Material callbacks

    let uniforms = null, frameIndex = -1;

    const tempCamera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1);

    const onBeforeRender = function( renderer, scene, camera, geometry, material, group ) {

        if ( material.callbacks  ) {

            currentObject = this;

            if ( renderer.info.render.frame !== frameIndex ) {

                context.scene = scene;
                context.camera = camera;
                context.renderer = renderer;
                context.gl = renderer.getContext();

                frameIndex = renderer.info.render.frame;

                if ( onBeforeRender.auto !== false )
                    onBeforeRender.frame();

            }

            context.material = material;
            context.geometry = geometry;
            context.group = group;

            if ( !material.program )
                renderer.compile( this, tempCamera, this );



            uniforms = renderer.properties.get( material ).shader.uniforms;

            context.gl.useProgram( material.program.program );

            const map = material.program.getUniforms().map;

            for ( let i = 0, l = material.callbacks.length; i < l; i ++ )
                material.callbacks[i].render( this, map, context );


            uniforms = null;


        }

    };

    onBeforeRender.auto = true;
    onBeforeRender.frame = function() {

        for ( let i = 0, l = context.callbacks.length; i < l; i ++ )
            context.callbacks[ i ].frame( context );

    };
    onBeforeRender.use = function() {

        THREE.Mesh.prototype.onBeforeRender = onBeforeRender;
        THREE.SkinnedMesh.prototype.onBeforeRender = onBeforeRender;

    };


    THREE.MaterialPlugin = function( object ) {

        this.uuid = THREE.Math.generateUUID();

        Object.assign( this, object );

    };

    THREE.MaterialCallback = onBeforeRender;

}());
