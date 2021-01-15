jQuery(document).ready(function ($) {

	// Create a Leap Motion Controller for incomming events from the device
	var controller = new Leap.Controller();

	// Create a GestureTrainer controller by passing the leap montion controller as a parameter.
	var trainer = new GestureMaker.Controller({controller: controller});

	// We get the DOM crawling done now during setup, so it's not consuming cycles at runtime.
	var windows					= $(window),
		gestureCreateBlock	= $('#createGestureBlock'),
		listOfExisitingGestures = $("#listofGestures"),
		renderArea 			= $('#areaOfRendering'),
		main				= $('#main'),
		outputText			= $('#outputDisplayText'),
		wegGlWarning		= $('#warningWebGL'),
		greenhand				= '#39ff14',
		green				= '#008000',
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

	function setGestureScale(gestureName, val, color) {		
	
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
			setGestureScale(gestureName, Math.min(parseInt(100 * allHits[gestureName]), 100), blue);
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
	
	// Now we set up a Leap controller frame listener in order to animate the scene
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

				}else{
					defaultHandPosition = false;
					hand = frame.hands[i];
					positionPalm(hand, palm);
					palm.visible = true;
					handFingers 	= hand.fingers;
					handFingerCount = handFingers.length;
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
	
	//Finally we set up the rendering of gestures. Gestures are rendered by placing hand renders periodically along a recorded set of hand positions. 
	// We save each render in the renderedHands array so that the previous gesture can be deleted before a new one is rendered.
	var renderedHands = [];
	
	// Removes the currently rendered gesture, if any.
	function clearGesture() {
		new TWEEN.Tween(camera.position).to({x: cameraInitialPos.x, y: cameraInitialPos.y, z: cameraInitialPos.z}).easing(TWEEN.Easing.Exponential.Out).start();
		new TWEEN.Tween(camera.rotation).to({x: 0, y: 0, z: 0}).easing(TWEEN.Easing.Exponential.Out).start();
		for (var i = 0, l = renderedHands.length; i < l; i++) { scene.remove(renderedHands[i]); }
		renderedHands = [];
	}
	

	// This function is called when a training gesture is saved and when a gesture is recognized.  It depends on the GestureMaker 
	// Controller providing a renderableGesture array.

	function renderGesture() {
		
		if (!webGl) { return; } // Gesture renders are entirely disabled for canvas renderers (it's just too slow at the moment!)

		// Only one gesture is rendered at a time, so first the current gesture - if any - is removed.
		clearGesture();

		// The GestureMaker controller should provide a renderableGesture array, which should always contain positioning data for the LAST gesture recorded. 
		var gestureFrames = trainer.renderableGesture;
		if (!gestureFrames || gestureFrames.length == 0) { return; } // If the controller doesn't supply this variable, or the array is empty, we return.

		// Some variables are set up in order to avoid creation in the loops
		var frame, hand, handObject, palm, fingers, finger, fingerMesh, material;
		for (var i = 0, l = gestureFrames.length; i < l; i += gestureRenderInterval) { // Not all frames are necessarily rendered
			frame = gestureFrames[i];
			material = new THREE.MeshBasicMaterial({wireframe: true, color: white, transparent: true, opacity: Math.min(0.02 * i, 0.5) });
			for (var j = 0, k = frame.length; j < k; j++) {
				hand = frame[j];
				handObject = new THREE.Object3D();
				
				// Palm
				palm = createPalm();
				palm.material = material;
				positionPalm(hand, palm);
				handObject.add(palm);
				
				// Fingers
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

	//Add previously saved gestures
	controller.connect();
	var trainer1 = new GestureMaker.Controller();




	
	trainer1.fromJSON('{"name":"Z","pose":false,"data":[[{"x":0.4112867234507097,"y":-0.2318669524919712,"z":0.25058022169404487,"stroke":1},{"x":0.3731709892509376,"y":-0.16590879804896513,"z":0.17500146701189484,"stroke":1},{"x":0.32377502454788143,"y":-0.0978277081031835,"z":0.09721147535359448,"stroke":1},{"x":0.25867488710369113,"y":-0.028368505793854415,"z":0.017138148378519458,"stroke":1},{"x":0.1770679207680398,"y":0.04034384588818446,"z":-0.064353331459819,"stroke":1},{"x":0.08645527607957904,"y":0.1051760725716071,"z":-0.14568001678252082,"stroke":1},{"x":-0.00302899802950396,"y":0.16314410865276013,"z":-0.22321502661432016,"stroke":1},{"x":-0.07745408942165222,"y":0.21588856128931977,"z":-0.2951872611763329,"stroke":1},{"x":-0.09704908459159728,"y":0.17423859361174138,"z":-0.2425985312020383,"stroke":1},{"x":-0.10591515640196597,"y":0.11923206915517282,"z":-0.1657600928846971,"stroke":1},{"x":-0.10985238595412816,"y":0.06435524652712288,"z":-0.09035408712556398,"stroke":1},{"x":-0.11019620225246307,"y":0.011448335966250694,"z":-0.016656342920618128,"stroke":1},{"x":-0.11325048448862512,"y":-0.03393721469036265,"z":0.04935497314430226,"stroke":1},{"x":-0.11205798749265511,"y":-0.0799762707208724,"z":0.11878610449205446,"stroke":1},{"x":-0.10473747152324542,"y":-0.12647535840778185,"z":0.1886248954587702,"stroke":1},{"x":-0.09874449456346979,"y":-0.16720396265707932,"z":0.25239258443506346,"stroke":1},{"x":-0.10943118993224227,"y":-0.18922317564899363,"z":0.2871004657249128,"stroke":1},{"x":-0.5887132765492903,"y":0.2269611129009046,"z":-0.19238564552724663,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"Y","pose":true,"data":[[{"x":0.09243291210799964,"y":-0.201010772320016,"z":0.16743689867618006,"stroke":1},{"x":0.2184865824215999,"y":-0.1780351266639179,"z":0.16818386302202348,"stroke":1},{"x":0.3445402527352003,"y":-0.15505948100781985,"z":0.16893082736786702,"stroke":1},{"x":-0.6554597472647997,"y":0.5341053799917538,"z":-0.5045515890660706,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"X","pose":true,"data":[[{"x":-0.1794526006705347,"y":-0.22123049681367377,"z":0.3472222222222222,"stroke":1},{"x":-0.1579182885900705,"y":-0.19468283719603294,"z":0.3055555555555556,"stroke":1},{"x":0.3373708892606052,"y":0.41591333400970665,"z":-0.6527777777777778,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"W","pose":true,"data":[[{"x":0.026158721486292946,"y":-0.23326955670675514,"z":0.2930270063425864,"stroke":1},{"x":0.08689777640889346,"y":-0.15449487941557194,"z":0.21550450105709773,"stroke":1},{"x":0.1476368313314939,"y":-0.07572020212438876,"z":0.13798199577160897,"stroke":1},{"x":0.20837588625409437,"y":0.0030544751667947456,"z":0.060459490486120315,"stroke":1},{"x":-0.46906921548077457,"y":0.4604301630799211,"z":-0.7069729936574136,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"V","pose":true,"data":[[{"x":0.02223102391533291,"y":-0.2576137373517244,"z":0.2890224821812606,"stroke":1},{"x":0.066940811806665,"y":-0.198514610758493,"z":0.23699250593957988,"stroke":1},{"x":0.11165059969799707,"y":-0.13941548416526162,"z":0.18496252969789906,"stroke":1},{"x":-0.20082243541999495,"y":0.5955438322754791,"z":-0.7109775178187394,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"U","pose":true,"data":[[{"x":-0.021494358078960364,"y":-0.28506438025595837,"z":0.22001992552786975,"stroke":1},{"x":-0.003591907302420011,"y":-0.2383118732480139,"z":0.18400608992543477,"stroke":1},{"x":0.014310543474120342,"y":-0.19155936624006942,"z":0.1479922543229999,"stroke":1},{"x":0.010775721907260033,"y":0.7149356197440416,"z":-0.5520182697763041,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"R","pose":true,"data":[[{"x":-0.15807936885894336,"y":-0.22537435946080656,"z":0.27822736112890767,"stroke":1},{"x":-0.1227154017870486,"y":-0.18021807448256355,"z":0.24059087962369752,"stroke":1},{"x":-0.08735143471515383,"y":-0.13506178950432052,"z":0.20295439811848726,"stroke":1},{"x":0.36814620536114573,"y":0.5406542234476907,"z":-0.7217726388710923,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"Q","pose":true,"data":[[{"x":-0.1548162757872843,"y":0.32122305316700683,"z":-0.08054327682801325,"stroke":1},{"x":-0.1891891771874901,"y":0.22625898227766428,"z":-0.053421652234906525,"stroke":1},{"x":-0.2235620785876959,"y":0.13129491138832172,"z":-0.026300027641799797,"stroke":1},{"x":0.5675675315624702,"y":-0.6787769468329932,"z":0.16026495670471957,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"P","pose":true,"data":[[{"x":-0.28246264962669854,"y":0.07613829996667576,"z":-0.019273673298636076,"stroke":1},{"x":-0.23917911679110046,"y":0.050471828111789185,"z":-0.0015961498784936787,"stroke":1},{"x":-0.19589558395550238,"y":0.02480535625690261,"z":0.01608137354164872,"stroke":1},{"x":0.7175373503733015,"y":-0.15141548433536756,"z":0.004788449635481029,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"O","pose":true,"data":[[{"x":0.3085829564484739,"y":-0.12664949802222317,"z":0.03833841788781192,"stroke":1},{"x":0.23047234785050863,"y":-0.12865351683802617,"z":0.04330656085289872,"stroke":1},{"x":0.15236173925254337,"y":-0.13065753565382915,"z":0.04827470381798554,"stroke":1},{"x":-0.6914170435515261,"y":0.38596055051407846,"z":-0.12991968255869618,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"L","pose":true,"data":[[{"x":-0.1875534299749111,"y":-0.19932040519802063,"z":0.07079005894910584,"stroke":1},{"x":-0.09040359054285935,"y":-0.2398640810396041,"z":0.05854903199050021,"stroke":1},{"x":0.006746248889192397,"y":-0.2804077568811876,"z":0.046308005031894584,"stroke":1},{"x":0.2712107716285781,"y":0.7195922431188124,"z":-0.1756470959715007,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"K","pose":true,"data":[[{"x":-0.07155378393528156,"y":-0.21722917769994918,"z":0.24575155973405638,"stroke":1},{"x":0.00024892316471894493,"y":-0.1793174808154886,"z":0.20762525995567604,"stroke":1},{"x":0.0720516302647195,"y":-0.14140578393102798,"z":0.16949896017729582,"stroke":1},{"x":0.14385433736472003,"y":-0.10349408704656742,"z":0.1313726603989155,"stroke":1},{"x":-0.14460110685887684,"y":0.6414465294930332,"z":-0.7542484402659436,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"J","pose":false,"data":[[{"x":0.01515561357855083,"y":0.0639225457846706,"z":0.44563888168920707,"stroke":1},{"x":-0.12601393638289063,"y":0.26647888769549505,"z":0.17591566262229485,"stroke":1},{"x":-0.268436189551766,"y":0.41985854899102165,"z":-0.13886739380920965,"stroke":1},{"x":-0.3161071824008529,"y":0.3899444947551624,"z":-0.33019152189932827,"stroke":1},{"x":-0.15518740103972525,"y":0.16642185264139925,"z":-0.035636024753936735,"stroke":1},{"x":-0.015381948529004541,"y":0.06815948338114014,"z":0.34137312513630724,"stroke":1},{"x":-0.08517126011187731,"y":0.07810852001096658,"z":0.09895828850848398,"stroke":1},{"x":-0.17988638869431176,"y":-0.01117726049833273,"z":-0.40142158814546425,"stroke":1},{"x":-0.09084378689848072,"y":-0.11092148473085267,"z":-0.31236288991512795,"stroke":1},{"x":0.0019525736633180246,"y":-0.023122209324198173,"z":0.2129487267719139,"stroke":1},{"x":-0.002307610502536195,"y":-0.05151444914091691,"z":0.13780959045323926,"stroke":1},{"x":0.028825461443405143,"y":-0.29400734500368714,"z":-0.3473909159338688,"stroke":1},{"x":0.10775272395931268,"y":-0.3665009129893679,"z":-0.2424465392349512,"stroke":1},{"x":0.07832127923794546,"y":-0.11799505952917283,"z":0.20439643549768538,"stroke":1},{"x":0.04807430423753223,"y":-0.053808243908365416,"z":0.28293367749447196,"stroke":1},{"x":0.27536093039223397,"y":-0.32253825044241347,"z":0.02986687490392831,"stroke":1},{"x":0.6838928175991471,"y":-0.1013091176925478,"z":-0.12152438938564653,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"I","pose":true,"data":[[{"x":0.24522261001091422,"y":-0.34722222222222227,"z":0.3356894567097972,"stroke":1},{"x":0.21579589680960448,"y":-0.3055555555555555,"z":0.2954067219046216,"stroke":1},{"x":-0.46101850682051876,"y":0.6527777777777777,"z":-0.6310961786144188,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"H","pose":true,"data":[[{"x":-0.28469579087320057,"y":-0.12037708821395818,"z":-0.08585361468874197,"stroke":1},{"x":-0.2384347363755998,"y":-0.07994879963993107,"z":-0.07516164911139461,"stroke":1},{"x":-0.19217368187799905,"y":-0.03952051106590397,"z":-0.06446968353404725,"stroke":1},{"x":0.7153042091267994,"y":0.23984639891979323,"z":0.22548494733418384,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"G","pose":true,"data":[[{"x":-0.34722222222222215,"y":-0.24039594831622724,"z":0.10308070781246145,"stroke":1},{"x":-0.3055555555555555,"y":-0.2115484345182799,"z":0.0907110228749661,"stroke":1},{"x":0.6527777777777779,"y":0.4519443828345071,"z":-0.19379173068742758,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"F","pose":true,"data":[[{"x":0.08725590261752664,"y":-0.29755639947967216,"z":0.16575234469685785,"stroke":1},{"x":0.10146663480549428,"y":-0.2162593999132787,"z":0.10852476668003869,"stroke":1},{"x":0.11567736699346193,"y":-0.13496240034688525,"z":0.05129718866321953,"stroke":1},{"x":0.12988809918142957,"y":-0.053665400780491784,"z":-0.005930389353599574,"stroke":1},{"x":-0.43428800359791236,"y":0.7024436005203278,"z":-0.3196439106865165,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"E","pose":true,"data":[[{"x":-0.15105329685741187,"y":0.0416586981273703,"z":0.125615959552634,"stroke":1},{"x":-0.048184642957317725,"y":0.0029777837882371816,"z":0.10199267022248243,"stroke":1},{"x":0.05468401094277642,"y":-0.03570313055089594,"z":0.07836938089233081,"stroke":1},{"x":0.15755266484287056,"y":-0.07438404489002906,"z":0.05474609156217919,"stroke":1},{"x":0.2604213187429646,"y":-0.11306495922916218,"z":0.03112280223202757,"stroke":1},{"x":0.3632899726430586,"y":-0.1517458735682953,"z":0.007499512901876004,"stroke":1},{"x":-0.6367100273569414,"y":0.33026152632277506,"z":-0.3993464173635302,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"D","pose":true,"data":[[{"x":-0.0043986414700538795,"y":-0.34722222222222227,"z":0.043210087551104656,"stroke":1},{"x":-0.003870804493647413,"y":-0.30555555555555547,"z":0.03802487704497212,"stroke":1},{"x":0.008269445963701293,"y":0.6527777777777777,"z":-0.08123496459607676,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"C","pose":true,"data":[[{"x":-0.207877588855557,"y":-0.06463879508752798,"z":-0.07616242174238608,"stroke":1},{"x":-0.13266042741918038,"y":-0.06014348146467351,"z":0.0004944258674490776,"stroke":1},{"x":-0.057443265982803776,"y":-0.0556481678418189,"z":0.07715127347728423,"stroke":1},{"x":0.017773895453572802,"y":-0.05115285421896442,"z":0.1538081210871194,"stroke":1},{"x":0.09299105688994944,"y":-0.04665754059610981,"z":0.23046496869695454,"stroke":1},{"x":0.16820821832632601,"y":-0.042162226973255335,"z":0.3071218163067897,"stroke":1},{"x":0.11900811158769278,"y":0.3204030661823499,"z":-0.6928781836932103,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"B","pose":true,"data":[[{"x":0.013031008790241105,"y":-0.32460225587580654,"z":0.2311854404445456,"stroke":1},{"x":0.06420057551437708,"y":-0.22984090235032262,"z":0.17492491594791415,"stroke":1},{"x":0.11537014223851294,"y":-0.1350795488248387,"z":0.11866439145128271,"stroke":1},{"x":0.1665397089626488,"y":-0.040318195299354764,"z":0.062403866954651055,"stroke":1},{"x":0.21770927568678455,"y":0.05444315822612916,"z":0.006143342458019396,"stroke":1},{"x":-0.5768507111925646,"y":0.6753977441241934,"z":-0.5933219572564128,"stroke":1}]]}');
	trainer1.fromJSON('{"name":"A","pose":true,"data":[[{"x":-0.34722222222222227,"y":-0.07931804370775501,"z":0.1148214775823366,"stroke":1},{"x":-0.3055555555555556,"y":-0.06979987846282433,"z":0.10104290027245619,"stroke":1},{"x":0.6527777777777777,"y":0.14911792217057934,"z":-0.21586437785479282,"stroke":1}]]}');
});





