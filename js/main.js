require(
{
		// use top level so we can access images
		baseUrl: './',
		packages: [{
				name: 'physicsjs',
				location: 'http://wellcaffeinated.net/PhysicsJS/assets/scripts/vendor/physicsjs-0.5.2/',
				main: 'physicsjs-0.5.2.min'
		}]
},
[
		'require',
		'physicsjs',

		// custom modules
		'js/player',
		'js/player-behavior',
		'js/asteroid',
		'js/gamestate',

		// official modules
		'physicsjs/renderers/canvas',
		'physicsjs/bodies/circle',
		'physicsjs/bodies/convex-polygon',
		'physicsjs/behaviors/newtonian',
		'physicsjs/behaviors/sweep-prune',
		'physicsjs/behaviors/body-collision-detection',
		'physicsjs/behaviors/body-impulse-response'
], function(
		require,
		Physics
){
		// display start game message
		document.body.className = 'before-game';
		var inGame = false;
		document.addEventListener('keydown', function( e ){

				// if user presses spacebar inbetween games, we'll load a new game
				if (!inGame && e.keyCode === 90){
						document.body.className = 'in-game';
						inGame = true;
						newGame();
				}
		});

		var gameState = new GameState();

		// set up the renderer and point it to the viewport
		var renderer = Physics.renderer('canvas', {
				el: 'viewport',
				width: window.innerWidth,
				height: window.innerHeight,
				// meta: true,
				// debug:true,
				styles: {
						'circle': {
								strokeStyle: 'rgb(0, 30, 0)',
								lineWidth: 1,
								fillStyle: 'rgb(100, 200, 50)',
								angleIndicator: true
						},
						'convex-polygon' : {
								strokeStyle: 'rgb(60, 0, 0)',
								lineWidth: 1,
								fillStyle: 'rgb(60, 16, 11)',
								angleIndicator: false
						}
				}
		});

		var init = function init( world, Physics ){

			world.options({timestep:1000/30}); // set to 30 FPS

				// bodies
				var ship = Physics.body('player', {
						x: 400,
						y: 100,
						vx: 0.08,
						radius: 30,
						mass: 30
				});
				ship.gameType = 'ship';

				var playerBehavior = Physics.behavior('player-behavior', { player: ship });

				var asteroids = [];
				for ( var i = 0, l = 30; i < l; ++i ){

						var ang = 4 * (Math.random() - 0.5) * Math.PI;
						var r = 700 + 100 * Math.random() + i * 10;

						asteroids.push( Physics.body('asteroid', {
								x: 400 + Math.cos( ang ) * r,
								y: 300 + Math.sin( ang ) * r,
								vx: 0.03 * Math.sin( ang ),
								vy: - 0.03 * Math.cos( ang ),
								angularVelocity: (Math.random() - 0.5) * 0.001,
								radius: 20,
								mass: 30,
								restitution: 0.6
						}));
				}

				//var planet = Physics.body('circle', {
						// fixed: true,
						// hidden: true,
				//    mass: 10000,
				//   radius: 140,
				//    x: 400,
				//    y: 300
				//});
				//planet.view = new Image();
				//planet.view.src = require.toUrl('images/planet.png');

				// render on every step
				world.subscribe('step', function(){
						// middle of canvas
						var middle = {
								x: 0.5 * window.innerWidth,
								y: 0.5 * window.innerHeight
						};
						// follow player
						renderer.options.offset.clone( middle ).vsub( ship.state.pos );
						world.render();
				});

				// count number of asteroids destroyed
				var killCount = 0;
				world.subscribe('blow-up', function( data ){

						killCount++;
						if ( killCount === asteroids.length ){
								world.publish('win-game');
						}
				});

				var points = 0;
				document.getElementById('score').innerHTML=points;
				world.subscribe('collect-point', function( data ){

						points++;
						//document.getElementById('score').innerHTML=points;
						gameState.setScore(points);

				});

				var time = 30;
				document.getElementById('time').innerHTML=time;
				var countDown = setInterval(function(){
						time --;
						document.getElementById('time').innerHTML=time;
						if (time <= 0){
								world.publish({
										topic: 'lose-game',
										body: self
								});
								clearInterval(countDown);
						}
				},1000);

				// blow up anything that touches a laser pulse
				world.subscribe('collisions:detected', function( data ){
						var collisions = data.collisions
								,col
								;

						for ( var i = 0, l = collisions.length; i < l; ++i ){
								col = collisions[ i ];

								if ( col.bodyA.gameType === 'laser' || col.bodyB.gameType === 'laser' ){
										if ( col.bodyA.blowUp ){
												col.bodyA.blowUp();
												world.removeBody( col.bodyB );
										} else if ( col.bodyB.blowUp ){
												col.bodyB.blowUp();
												world.removeBody( col.bodyA );
										}
										return;
								}
								if ( col.bodyA.gameType === 'ship' || col.bodyB.gameType === 'ship' ){
										if ( col.bodyA.gameType === 'debris' ) {
												world.removeBody( col.bodyA );
												world.publish({
														topic: 'collect-point',
														body: self
												});
												return;
										} else if (col.bodyB.gameType === 'debris' ){
												world.removeBody( col.bodyB );
												world.publish({
														topic: 'collect-point',
														body: self
												});
												return;
										}
								}
						}
				});

				// draw minimap
				world.subscribe('render', function( data ){
						// radius of minimap
						var r = 100;
						// padding
						var shim = 15;
						// x,y of center
						var x = renderer.options.width - r - shim;
						var y = renderer.options.height - (r + shim);
						// the ever-useful scratchpad to speed up vector math
						var scratch = Physics.scratchpad();
						var d = scratch.vector();
						var lightness;

						// draw the radar guides
						renderer.drawCircle(x, y, r, { strokeStyle: '#090', fillStyle: '#010' });
						//renderer.drawCircle(x, y, r * 2 / 3, { strokeStyle: '#090' });
						//renderer.drawCircle(x, y, r / 3, { strokeStyle: '#090' });

						for (var i = 0, l = data.bodies.length, b = data.bodies[ i ]; b = data.bodies[ i ]; i++){

								// get the displacement of the body from the ship and scale it
								d.clone( ship.state.pos ).vsub( b.state.pos ).mult( -0.05 );
								// color the dot based on how massive the body is
								lightness = Math.max(Math.min(Math.sqrt(b.mass*10)|0, 100), 10);
								// if it's inside the minimap radius
								if (d.norm() < r && b.mass > 1){
										// draw the dot
										renderer.drawCircle(x + d.get(0), y + d.get(1), 1, 'hsl(60, 100%, '+lightness+'%)');
								}
						}

						scratch.done();
				});

				// add things to the world
				world.add([
						ship,
						playerBehavior,
						//planet,
						Physics.behavior('newtonian', { strength: 1e-4 }),
						Physics.behavior('sweep-prune'),
						Physics.behavior('body-collision-detection'),
						Physics.behavior('body-impulse-response'),
						renderer
				]);
				world.add( asteroids );
		};

		var world = null;
		var newGame = function newGame(){

				if (world){
						world.destroy();
				}


				//time = 5;

				world = Physics( init );
				world.subscribe('lose-game', function(){
						document.body.className = 'lose-game';
						inGame = false;
				});
				world.subscribe('win-game', function(){
						world.pause();
						document.body.className = 'win-game';
						inGame = false;
				});
		};

		// subscribe to ticker and start looping
		Physics.util.ticker.subscribe(function( time ){
				if (world){
						world.step( time );
				}
		}).start();
});