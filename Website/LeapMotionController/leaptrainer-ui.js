jQuery(document).ready(function ($) {

	// Create a Leap Motion Controller for incomming events from the device
	var controller = new Leap.Controller();

	// Create a GestureTrainer controller by passing the leap montion controller as a parameter.
	var trainer = new GestureMaker.Controller({controller: controller});

	// We get the DOM crawling done now during setup, so it's not consuming cycles at runtime.
	var windows					= $(window),
		gestureCreateBlock	= $('#createGestureBlock'),
		gestureCreationForm		= $('#formGestureCreation'),
		listOfExisitingGestures = $("#listofGestures"),
		newNameOfGesture		= $('#NameofNewgesture'),
		renderArea 			= $('#areaOfRendering'),
		main				= $('#main'),
		outputText			= $('#outputDisplayText'),
		wegGlWarning		= $('#warningWebGL'),
		//red					= '#FF0000',
		greenhand				= '#39ff14',
		green				= '#008000',
		yellow				= '#EFF57E',
		blue				= '#AFDFF1',
		white				= '#FFFFFF',
		purpule             = '#FF00FF',

	//Setiing up the WebGL
		webGl				= Detector.webgl,
		renderer 			= webGl ? new THREE.WebGLRenderer({antialias:true}) : new THREE.CanvasRenderer(),
		material 			= new THREE.MeshBasicMaterial({color: purpule }),		
		recordingMaterial 	= new THREE.MeshBasicMaterial({color: greenhand }),	
		palmGeometry 		= new THREE.CubeGeometry(60, 10, 60),				
		fingerGeometry 		= webGl ? new THREE.SphereGeometry(5, 20, 10) : new THREE.TorusGeometry(1, 5, 5, 5), 
		camera 				= new THREE.PerspectiveCamera(45, 2/1, 1, 3000),
		cameraInitialPos	= new THREE.Vector3(0, 0, 450),
		scene 				= new THREE.Scene(),
		controls 			= new THREE.OrbitControls(camera, renderer.domElement),
		gestureRenderInterval = webGl ? 3 : 6,
		windowHeight, 				
		windowWidth, 				
		gestureEntries 		= {},	
		progressBars 		= {},	
		gestureLabels 		= {},	
		gestureArrows 		= {},	
		training 			= false; 

	//Check if WebGL is supported
	if (webGl) { wegGlWarning.remove(); } else { wegGlWarning.css({display: 'block'}); }
	controls.noPan = true;
	
	
	// Resizeing the window
	function windowResizing() {
		windowHeight 		= windows.innerHeight();
		windowWidth 		= windows.innerWidth();
		main.css			({height: windowHeight});
		var renderHeight 	= windowHeight - 5;
		renderArea.css({width: windowWidth, height: renderHeight});
		renderer.setSize(windowWidth, renderHeight);
		var outputTextLeft = (windowWidth < 1000) ? 100 : 22; 
		outputText.css({left: outputTextLeft, width: windowWidth - outputTextLeft - 22, fontSize: Math.max(22, windowWidth/55)});
	}			
	windowResizing();
	windows.resize(windowResizing);		
	
	


	//Functions to display output text
	function displayTextOutput(text) { 
		outputText.html(text ? text : ''); 
	};

	//Clears all gestures and clear progress bar 
	function unselectAllGestures(resetProgressBars) {		

		if (resetProgressBars) {
			for (arrow in gestureArrows) { 
				gestureArrows[arrow].css({background: 'transparent'}); 
			}
			var bar;
			
			for (barName in progressBars) { 
				
				bar = progressBars[barName];
				bar.css({width: '0%', background: blue});
				bar.parent().removeClass('selected'); 
			}			
		}

		for (label in gestureLabels) { 
			gestureLabels[label].html('&nbsp;'); 
		}
	}

	function setGestureScale(gestureName, val, color, arrowColor) {		
		gestureArrows[gestureName].css({display: arrowColor == 'transparent' ? 'none' : 'block', background: arrowColor});
		var bar = progressBars[gestureName];
		bar.css({background: color});
		bar.animate({width: val + '%'}, 200, 'swing');
	}
	
	function setAllGestureScales(allHits, excluding) {		
		for (var gestureName in allHits) {  
			if (gestureName == excluding) { 
				continue; 
			}
			setGestureLabel(gestureName);
			setGestureScale(gestureName, Math.min(parseInt(100 * allHits[gestureName]), 100), blue, 'transparent');
		}
	}
	
	//Sets the text at the right of a gesture list entry
	function setGestureLabel(gestureName, val) { 
		gestureLabels[gestureName].html(val ? val : '&nbsp;'); 
	}

	//When Connection is lost with the leap motion controller
	function disableUI(color, message) {
		main.css({background: color});
		gestureCreateBlock.css({display: 'none'});
		outputText.css({background: 'transparent'});		
		displayTextOutput(message);
	}	
	
	//When connection to leap motion controller is establish
	function enableUI(message) {
		main.css({background: ''});
		gestureCreateBlock.css({display: ''});
		outputText.css({background: ''});
		displayTextOutput(message);
	}	
	

	//Training event listeners
	trainer.on('gestureAdded', function(gestureName) {
		
		var gesture = $('<li' + (' class="selected"') +'><div class="progress"><span class="gesture-name">' + gestureName + 
						'</span><img class="arrow"  /></div>' + 
						'<img class="export-arrow" src="./Images/export-arrow.png" />' + 
						'<span class="label">&nbsp;</span></li>');

		
		var items = listOfExisitingGestures.find('li');
		
		if (items.length == 0) {
			listOfExisitingGestures.append(gesture);
		} else {
			unselectAllGestures(true);
			$("#listofGestures li").first().before(gesture);
		}


		gestureEntries[gestureName]	= $(gesture[0]);
		progressBars[gestureName] 	= $(gesture.find('.progress')[0]);
		gestureLabels[gestureName] 	= $(gesture.find('.label')[0]);
		gestureArrows[gestureName] 	= $(gesture.find('.progress .arrow')[0]);
		

	});

	//When the gesture is recognised the selected gesture in the list progress bar is highlighted and the precentage match is displaed.
	trainer.on('gesture-recognized', function(hit, gestureName, allHits) {
		unselectAllGestures(false);
		setAllGestureScales(allHits, gestureName);
		renderGesture();
		var hitPercentage = Math.min(parseInt(100 * hit), 100);
		setGestureScale(gestureName, hitPercentage, green, green);
		displayTextOutput('<span style="font-weight: bold">' + gestureName + '</span> : ' + hitPercentage + '% MATCH');
	});	

	//Resets everything if unknow gesture is detedected
	trainer.on('gesture-unknown', function(allHits) {
		unselectAllGestures(false);
		displayTextOutput();
		setAllGestureScales(allHits);
		clearGesture();
	});

	//*******Leap motion controller event listeners*********//

	//When the leap motion is connected display this
	controller.on('connect', function() { displayTextOutput('Make a static gesture to identify'); });


	//**************Fuction used for WebGL rendering****************//

	// Set camera to initial position 
	camera.position.set(cameraInitialPos.x, cameraInitialPos.y, cameraInitialPos.z);
	renderArea.append(renderer.domElement);

	//Create the handpalm mesh
	function createPalm() { 
		return new THREE.Mesh(palmGeometry, material); 
	}

	// Creates a finger mesh
	function createFinger() { 
		return new THREE.Mesh(fingerGeometry, material); 
	}
	
	//This adds a intial pair of hand to the scene. The second hand is not visible intially.
	var palms = [createPalm(), createPalm()];
	palms[1].visible = false;
	scene.add(palms[0]);
	scene.add(palms[1]);
	var finger, fingers = [];
	
	for (var j = 0; j < 10; j++) { 
		finger = new THREE.Mesh(fingerGeometry, material);
		finger.visible = j < 5;
		scene.add(finger);
		fingers.push(finger); 	
	}
	

	var defaultHandPosition = true; 
	
	//This is used as a flag to check is scene is currently showing a default pose.
	function setHandMaterial(m) {
		palms[0].material = m;
		palms[1].material = m;
		for (var i = 0, l = fingers.length; i < l; i++) { 
			fingers[i].material = m; 
		}		
	}
	

	trainer.on('recordingStart', function () { setHandMaterial(recordingMaterial); })
		   .on('stopped-recording', function () { setHandMaterial(material); });
	
	//Paul Irish's requestAnimFrame function for updating the scene will be used.
	window.requestAnimFrame = (function(){
		  return  window.requestAnimationFrame       ||
		          window.webkitRequestAnimationFrame ||
		          window.mozRequestAnimationFrame    ||
		          function(callback){ window.setTimeout(callback, 1000 / 60); };
		})();
	
	// And bind a simple update function into the requestAnimFrame function
	function updateRender() { 
		controls.update(); TWEEN.update(); renderer.render(scene, camera); requestAnimFrame(updateRender); 
	}

	requestAnimFrame(updateRender);
	var hand, palm, position, direction, normal, handFingers, handFingerCount, finger, handCount, palmCount = palms.length;
	var yOffset = -170;	
	
	// The positionPalm and positionFinger functions, as well as the structure of the leap controller listener below, are based on code from jestPlay 
	function positionPalm(hand, palm) {
		position = hand.stabilizedPalmPosition || hand.position;
		palm.position.set(position[0], position[1] + yOffset, position[2]); 
		direction = hand.direction;
		palm.lookAt(new THREE.Vector3(direction[0], direction[1], direction[2]).add(palm.position));
		normal = hand.palmNormal || hand.normal;
		palm.rotation.z = Math.atan2(normal[0], normal[1]);
	}
	

	function positionFinger(handFinger, finger) {
		position = handFinger.stabilizedTipPosition || handFinger.position;
		finger.position.set(position[0], position[1] + yOffset, position[2]);
		direction = handFinger.direction;
		finger.lookAt(new THREE.Vector3(direction[0], direction[1], direction[2]).add(finger.position));
		finger.scale.z = 0.1 * handFinger.length;		
	}
	
	/*
	 * Now we set up a Leap controller frame listener in order to animate the scene
	 */
	var clock = new THREE.Clock();
	clock.previousTime = 1000000;	

	controller.on('frame', function(frame) {

		if (clock.previousTime === 1000000) {

			handCount = frame.hands.length;
			
			for (var i = 0; i < palmCount; i++) { // We attempt to position all (normally, both) rendered hands
				
				palm = palms[i];

				if (i >= handCount) {
				
					if (!defaultHandPosition) { // If the default pose is showing we don't update anything

						palm.visible = false;

						for (var j = 0, k = 5, p; j < k; j++) { p = (i * 5) + j; fingers[p].visible = false; };						
					}

				} else {
					
					defaultHandPosition = false;
					
					hand = frame.hands[i];

					positionPalm(hand, palm);
					
					palm.visible = true;

					handFingers 	= hand.fingers;
					handFingerCount = handFingers.length;

					/*
					 * 
					 */
					for (var j = 0, k = 5; j < k; j++) {
						
						finger = fingers[(i * 5) + j];

						if (j >= handFingerCount) {
							
							finger.visible = false;
							
						} else {

							positionFinger(handFingers[j], finger);
							
							finger.visible = true;
						}
					};
				}
			}	
		}
	});	
	
	/*
	 * Finally we set up the rendering of gestures.  Gestures are rendered by placing hand renders periodically along a recorded set of 
	 * hand positions. 
	 * 
	 * We save each render in the renderedHands array so that the previous gesture can be deleted before a new one is rendered.
	 */
	var renderedHands = [];
	
	/*
	 * Removes the currently rendered gesture, if any.
	 */
	function clearGesture() {
		
		new TWEEN.Tween(camera.position).to({x: cameraInitialPos.x, y: cameraInitialPos.y, z: cameraInitialPos.z}).easing(TWEEN.Easing.Exponential.Out).start();
		new TWEEN.Tween(camera.rotation).to({x: 0, y: 0, z: 0}).easing(TWEEN.Easing.Exponential.Out).start();

		for (var i = 0, l = renderedHands.length; i < l; i++) { scene.remove(renderedHands[i]); }
		
		renderedHands = [];
	}
	
	/**
	 * This function is called when a training gesture is saved and when a gesture is recognized.  It depends on the GestureMaker 
	 * Controller providing a renderableGesture array.
	 */
	function renderGesture() {
		
		if (!webGl) { return; } // Gesture renders are entirely disabled for canvas renderers (it's just too slow at the moment!)

		/*
		 * Only one gesture is rendered at a time, so first the current gesture - if any - is removed.
		 */
		clearGesture();

		/*
		 * The GestureMaker controller should provide a renderableGesture array, which should always contain positioning data for the 
		 * LAST gesture recorded.
		 */
		var gestureFrames = trainer.renderableGesture;
		
		if (!gestureFrames || gestureFrames.length == 0) { return; } // If the controller doesn't supply this variable, or the array is empty, we return.

		/*
		 * Some variables are set up in order to avoid creation in the loops
		 */
		var frame, hand, handObject, palm, fingers, finger, fingerMesh, material;
		
		for (var i = 0, l = gestureFrames.length; i < l; i += gestureRenderInterval) { // Not all frames are necessarily rendered
			
			frame = gestureFrames[i];
			
			
			material = new THREE.MeshBasicMaterial({wireframe: true, color: white, transparent: true, opacity: Math.min(0.02 * i, 0.5) });
			
			for (var j = 0, k = frame.length; j < k; j++) {
				
				hand = frame[j];
				
				handObject = new THREE.Object3D();
				
				/*
				 * Palm
				 */
				palm = createPalm();
				
				palm.material = material;
				
				positionPalm(hand, palm);

				handObject.add(palm);
				
				/*
				 * Fingers
				 */	
				fingers = hand.fingers;

				for (var p = 0, q = fingers.length; p < q; p++) {
					
					finger = fingers[p];
					
					fingerMesh = createFinger();

					fingerMesh.material = material;
					
					positionFinger(finger, fingerMesh);

					handObject.add(fingerMesh);
				}

				renderedHands.push(handObject);
				
				scene.add(handObject);
			}
		}
	}	

	controller.connect();
	var trainer1 = new GestureMaker.Controller();
	trainer1.fromJSON('{"name":"D","pose":true,"data":[[{"x":-0.09234213839732312,"y":-0.34722222222222227,"z":0.05982477548955352,"stroke":1},{"x":-0.08126108178964433,"y":-0.3055555555555556,"z":0.05264580243080706,"stroke":1},{"x":0.17360322018696744,"y":0.6527777777777777,"z":-0.11247057792036057,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"C","pose":true,"data":[[{"x":-0.2252003230880928,"y":-0.1085906823339539,"z":0.013612184049334286,"stroke":1},{"x":-0.12020035762363401,"y":-0.08444489633666744,"z":0.05884791963206726,"stroke":1},{"x":-0.015200392159175152,"y":-0.060299110339381255,"z":0.10408365521480034,"stroke":1},{"x":0.08979957330528371,"y":-0.0361533243420948,"z":0.1493193907975333,"stroke":1},{"x":0.1947995387697425,"y":-0.012007538344808333,"z":0.19455512638026629,"stroke":1},{"x":0.2997995042342012,"y":0.01213824765247784,"z":0.23979086196299926,"stroke":1},{"x":-0.22379754343832553,"y":0.2893573040444279,"z":-0.7602091380370007,"stroke":1}]]}');	
	trainer1.fromJSON('{"name":"B","pose":true,"data":[[{"x":0.060964984205396644,"y":-0.34080172178645673,"z":0.19894037971213707,"stroke":1},{"x":0.0994880185671232,"y":-0.23632068871458273,"z":0.13867353342684374,"stroke":1},{"x":0.13801105292884963,"y":-0.1318396556427087,"z":0.07840668714155036,"stroke":1},{"x":0.17653408729057607,"y":-0.027358622570834656,"z":0.018139840856256972,"stroke":1},{"x":0.21505712165230262,"y":0.07712241050103935,"z":-0.04212700542903658,"stroke":1},{"x":-0.6900552646442483,"y":0.6591982782135433,"z":-0.3920334357077513,"stroke":1}]]}');	
	trainer1.fromJSON('{"name":"A","pose":true,"data":[[{"x":-0.34722222222222227,"y":-0.11639885064850103,"z":0.10448654973898941,"stroke":1},{"x":-0.30555555555555564,"y":-0.1024309885706807,"z":0.09194816377031068,"stroke":1},{"x":0.6527777777777777,"y":0.2188298392191817,"z":-0.19643471350930009,"stroke":1}]]}');
});