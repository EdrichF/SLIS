
var GestureMaker = {};

/*
 * Create the basic class structure.
 * 
 * This root class provides the inheritance mechanism for defining alternative implementations as sub-classes of 
 * the GestureMaker.Controller. 
 * 
 *  To call an overidden function, use "this._super".
 */
(function() {

	var initializing = false, fnTest = /xyz/.test(function() { xyz; }) ? /\b_super\b/ : /.*/;

	// We create the base Class implementation and give it an 'extend' method
	
	this.Class = function() {};
	Class.extend = function(prop) {
		var _super = this.prototype;
		initializing = true, prototype = new this(); //Instantiate a base class - but don't run the initialization function yet
		initializing = false;

		// Copy the properties over onto the new prototype
		for (var name in prop) {

			//Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] == "function" && typeof _super[name] == "function" && fnTest.test(prop[name]) ? (function(name, fn) {
				return function() {
					var tmp = this._super;
					this._super = _super[name]; // Add a new ._super() method that is the same method but on the super-class
					var ret = fn.apply(this, arguments); // The method only need to be bound temporarily, so we remove it when we're done executing
					this._super = tmp;
					return ret;
				};

			})(name, prop[name]) : prop[name];
		}


		function Class() { if (!initializing && this.initialize) { this.initialize.apply(this, arguments); }}
		Class.prototype 			= prototype; 		//Populate our constructed prototype object
		Class.prototype.constructor = Class; 			//Enforce the constructor to be what we expect
		Class.extend 				= arguments.callee; //And make this class extendable
		Class.overidden 			= prop; 			//And store the list of overridden fields

		return Class; 
	};
})();

/*
 * Defining the base LeapTrainer Controller.  This class contains the default implementations of all functions. 
 * The constructor accepts an options parameter, which is then passed to the initialize in order to set up the object.
 */
GestureMaker.Controller = Class.extend({
	
	controller				: null,	// An instance of Leap.Controller from the leap.js library.  This will be created if not passed as an option
	minRecordingVelocity	: 300,	// The minimum velocity a frame needs to clock in at to trigger gesture recording, or below to stop gesture recording (by default)
	maxRecordingVelocity	: 30,	// The maximum velocity a frame can measure at and still trigger pose recording, or above which to stop pose recording (by default)
	minGestureFrames		: 5,	// The minimum number of recorded frames considered as possibly containing a recognisable gesture 
	minPoseFrames			: 75,	// The minimum number of frames that need to hit as recordable before pose recording is actually triggered
	recordedPoseFrames		: 0,	// A counter for recording how many pose frames have been recorded before triggering
	recordingPose			: false,// A flag to indicate if a pose is currently being recorded
	hitThreshold			: 0.65,	// The correlation output value above which a gesture is considered recognized. Raise this to make matching more strict
	downtime				: 1000,	// The number of milliseconds after a gesture is identified before another gesture recording cycle can begin
	lastHit					: 0,	// The timestamp at which the last gesture was identified (recognized or not), used when calculating downtime
	gestures				: {},	// The current set of recorded gestures - names mapped to convolved training data
	poses					: {},	// Though all gesture data is stored in the gestures object, here we hold flags indicating which gestures were recorded as poses
	listeners				: {},	// Listeners registered to receive events emit from the trainer - event names mapped to arrays of listener functions
	paused					: false,//  When true it disables frame monitoring temporarily.
	renderableGesture		: null, // Implementations that record a gestures for graphical rendering should store the data for the last detected gesture in this array.
	
	/**
	 * @param options
	 */
	initialize: function(options) {
		if (options) { for (var optionName in options) { if (options.hasOwnProperty(optionName)) { this[optionName] = options[optionName]; };};}
		//The current DEFAULT recognition algorithm is geometric template matching - which is initialized here.
		this.templateMatcher = new GestureMaker.TemplateMatcher();
		var connectController = !this.controller;
		
		if (connectController) { 
			this.controller = new Leap.Controller(); 
		}
		this.bindFrameListener();

		if (connectController) { 
			this.controller.connect(); 
		};
	},

	onFrame: function () {},

	//The following function is used to monitor activity coming from the leap motion by binding a listerner to the controller.
	//It also triggers the follow events: Gesture detect	
	bindFrameListener: function () {

		var recording = false, frameCount = 0, gesture = [],
		// These function is used to push a vector into a gesture array that stores the gestures during recording. Non number values are replaced with zeros.
	 	recordedGestureValues	 = function (val) 	{ gesture.push(isNaN(val) ? 0.0 : val); },
	 	recordedGestureVector	 = function (v) 	{ recordedGestureValues(v[0]); recordedGestureValues(v[1]); recordedGestureValues(v[2]); }; 

	this.onFrame = function(frame) {		

			 if (this.paused) { return; }
			 
			//This steps check if a frame occurs to quickly afer a gesture was recognized and ignores the frame.
			 if (new Date().getTime() - this.lastHit < this.downtime) { return; }
			
			//The recordableFrame function return true or false. when true recording should start or the current frame should be added to the recording.
			//When false and the recording is still running the recording has completed and the type of recognition function should be called.
			if (this.recordableFrame(frame, this.minRecordingVelocity, this.maxRecordingVelocity)) {

				//If it is the first frame for a gesture, the runing values are cleaned up.
				if (!recording) { 	
					recording 				= true; 
					frameCount 				= 0; 
					gesture 				= [];  
					this.renderableGesture 	= []; 
					this.recordedPoseFrames = 0;
					
				}
				//The amount of frames is counted that are recorded in a gesture to check that the frame count is greater than the minimum gesture frames.
				frameCount++;
	
				
				// The recordFrame function may be overridden, but in any case it's passed the current frame, the previous frame, and 
 				//utility functions for adding vectors and individual values to the recorded gesture activity.
				this.recordFrame(frame, recordedGestureVector);

				
				
			} else if (recording) {

				 // If the frame should not be recorded but recording was active, then we deactivate recording and check to see if enough 
				 // frames have been recorded to qualify for gesture recognition.
				recording = false;
				if (this.recordingPose || frameCount >= this.minGestureFrames) {

					// If a valid gesture was detected the 'gesture-detected' event fires, regardless of whether the gesture will be recognized or not.
					this.fire('gesture-detected', gesture, frameCount);
		
					
					 // Finally we pass the recorded gesture frames to the recognize functions.
					this.recognize(gesture, frameCount); 
					this.lastHit = new Date().getTime();
					this.recordingPose 		= false;
				};
			};
			
		}; // The frame listener is bound to the context of the GestureMaker object

		 //This is where the leap controller calls the frame listening function on every frame.	 
		this.controller.on('frame',	this.onFrame.bind(this)); 
		
	},
	
	/**
	 * @param frame
	 * @param min
	 * @returns {Boolean}
	 */
	recordableFrame: function (frame, min, max) {
		var hands = frame.hands, j, hand, fingers, palmVelocity, tipVelocity, poseRecordable = false;
		
		for (var i = 0, l = hands.length; i < l; i++) {
			hand = hands[i];
			palmVelocity = hand.palmVelocity;
			palmVelocity = Math.max(Math.abs(palmVelocity[0]), Math.abs(palmVelocity[1]), Math.abs(palmVelocity[2]));
			
			// If the hand moving above the minimum recording velocity, return true
			if (palmVelocity >= min) { return true; }
			if (palmVelocity <= max) { poseRecordable = true; break; }
			fingers = hand.fingers
			for (j = 0, k = fingers.length; j < k; j++) {
				tipVelocity = fingers[j].tipVelocity;
				tipVelocity = Math.max(Math.abs(tipVelocity[0]), Math.abs(tipVelocity[1]), Math.abs(tipVelocity[2]));
				
				// If the finger tip is moving above the minimum recording velocity, return true.
				if (tipVelocity >= min) { return true; }
				if (tipVelocity <= max) { poseRecordable = true; break; }
			};	
		};

		// A configurable number of frames have to hit as pose recordable before actual recording is triggered.
		if (poseRecordable) {
			this.recordedPoseFrames++;
			if (this.recordedPoseFrames >= this.minPoseFrames) {
				this.recordingPose = true;
				return true;
			}
		} else {
			this.recordedPoseFrames = 0;
		}
	},
	
	/**
	 * @param frame
	 * @param recordVector
	 */
	recordFrame: function(frame, recordVector) {
		var hands		= frame.hands;
		var handCount 	= hands.length;
		var hand, finger, fingers, fingerCount;

		for (var i = 0, l = handCount; i < l; i++) {
			hand = hands[i];
			recordVector(hand.stabilizedPalmPosition);
			fingers 	= hand.fingers;
			fingerCount = fingers.length;
			for (var j = 0, k = fingerCount; j < k; j++) {
				finger = fingers[j];
				recordVector(finger.stabilizedTipPosition);	
			};
		};
	},
	
	// This function is called to add the previously saved gestures. 
	// This function fires the 'gestureAdded' event.
	/** 
	 * @param gestureName
	 * @param trainLater
	 */
	create: function(gestureName) {
		this.gestures[gestureName] 	= [];
		this.fire('gestureAdded', gestureName);
	},

	/**
	 * @param gesture
	 * @param frameCount
	 */
	recognize: function(gesture, frameCount) {
		var gestures 			= this.gestures,
			threshold			= this.hitThreshold,
			allHits				= {},
			hit					= 0,
			bestHit				= 0,
			recognized			= false,
			closestGestureName	= null,
			recognizingPose		= (frameCount == 1); //Single-frame recordings are idenfied as poses

		// Cycle through all known gestures
		for (var gestureName in gestures) {

			// Don't attempt to compare gestures to poses
			if (this.poses[gestureName] != recognizingPose) { 
				hit = 0.0;
			}else {

				
				// For each know gesture we generate a correlation value between the parameter gesture and a saved 
				// set of training gestures. This correlation value is a numeric value between 0.0 and 1.0 describing how similar 
				// this gesture is to the training set.
				hit = this.correlate(gestureName, gestures[gestureName], gesture);				
			}

			// Each hit is recorded
			allHits[gestureName] = hit;
			
			//If the hit is equal to or greater than the configured hitThreshold, the gesture is considered a match.
			if (hit >= threshold) { recognized = true; }

			// If the hit is higher than the best hit so far, this gesture is stored as the closest match.
			if (hit > bestHit) { bestHit = hit; closestGestureName = gestureName; }
		}
		if (recognized) { 
			this.fire('gesture-recognized', bestHit, closestGestureName, allHits);
			this.fire(closestGestureName); 
		}else{
			this.fire('gesture-unknown', allHits);
		}
	},

	// This function accepts a set of training gestures and a newly input gesture and produces a number between 0.0 and 1.0 describing how closely the input gesture resembles the set of training gestures. 
	// The default implementation uses a GestureMaker.TemplateMatcher to perform correlation.
	/**
	 * @param gestureName
	 * @param trainingGestures
	 * @param gesture
	 * @returns {Number}
	 */
	correlate: function(gestureName, trainingGestures, gesture) { 
		gesture = this.templateMatcher.process(gesture);
		var nearest = +Infinity, foundMatch = false, distance;

		for (var i = 0, l = trainingGestures.length; i < l; i++) {
			distance = this.templateMatcher.match(gesture, trainingGestures[i]);
			if (distance < nearest) {
				//The distance calculated between the saved gesture and the parameter gesture.
				nearest = distance;
				foundMatch = true;
			}
		}
		return (!foundMatch) ? 0.0 : (Math.min(parseInt(100 * Math.max(nearest - 4.0) / -4.0, 0.0), 100)/100.0);
	},

	//This is a simple import function for restoring gestures.
	/**
	 * @param json
	 * @returns {Object}
	 */
	fromJSON: function(json) {
		var imp = JSON.parse(json);
		var gestureName = imp.name;
		this.create(gestureName, true);
		this.gestures[gestureName] = imp.data;
		this.poses[gestureName] = imp.pose;
		return imp;
	},

	// This is a standard event registration event paired with the fire event below, it provides an event-oriented mechanism for notifying external components when significant events happen.
	/**
	 * @param event
	 * @param listener
	 * @returns {Object} 
	 */
	on: function(event, listener) {
		var listening = this.listeners[event];
		if (!listening) { listening = []; }
		listening.push(listener);
		this.listeners[event] = listening;
		return this;
	},
	
	// This function is called in various function above in order to notify listening components when the events they're registered to hear occur.
	 /** 
	 * @param event
	 * @returns {Object} 
	 */
	fire: function(event) {
		var listening = this.listeners[event];
		
		if (listening) { 
			var args = Array.prototype.slice.call(arguments);
			args.shift();
			for (var i = 0, l = listening.length; i < l; i++) { listening[i].apply(this, args); }
		}
		return this;
	},
});


/*
 * GEOMETRIC TEMPLATE MATCHER
 * Everything below this point is a geometric template matching implementation. 
 */

//A basic holding class for a 3D point. 
/**
 * @param x
 * @param y
 * @param z
 * @param stroke
 * @returns {GestureMaker.Point}
 */
GestureMaker.Point = function (x, y, z, stroke) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.stroke = stroke; 
};

// An implementation of the geometric template mathcing algorithm.
GestureMaker.TemplateMatcher = Class.extend({
	pointCount	: 25, 							// Gestures are resampled to this number of points
	origin 		: new GestureMaker.Point(0,0,0), // Gestures are translated to be centered on this point

	//Prepares a recorded gesture for template matching - resampling, scaling, and translating the gesture to the origin.
	/**
	 * @param gesture
	 * @returns
	 */
	process: function(gesture) { 
		var points = [];
		var stroke = 1;

		for (var i = 0, l = gesture.length; i < l; i += 3) {
			points.push(new GestureMaker.Point(gesture[i], gesture[i + 1], gesture[i + 2], stroke));
		}
		return this.translateTo(this.scale(this.resample(points, this.pointCount)), this.origin);	
	},

	// This is the primary correlation function, called in the GestureMaker.Controller above in order to compare an detected gesture with known gestures.
	/**
	 * @param gesture
	 * @param trainingGesture
	 * @returns
	 */
	match: function (gesture, trainingGesture) {
		var l 			= gesture.length, 
		step 		= Math.floor(Math.pow(l, 1 - this.e)), 
		min 		= +Infinity,
		minf 		= Math.min;
		
		for (var i = 0; i < l; i += step) {
			min = minf(min, minf(this.gestureDistance(gesture, trainingGesture, i), this.gestureDistance(trainingGesture, gesture, i)));
		}
		return min;
	},

	// Calculates the geometric distance between two gestures.
	/**
	 * @param gesture1
	 * @param gesture2
	 * @param start
	 * @returns {Number}
	 */
	gestureDistance: function (gesture1, gesture2, start) {
		var p1l = gesture1.length;
		var matched = new Array(p1l);
		var sum = 0, i = start, index, min, d;

		do {
			index = -1, min = +Infinity;
			for (var j = 0; j < p1l; j++) {
				if (!matched[j]) {
					if (gesture1[i] == null || gesture2[j] == null) { continue; }
					d = this.distance(gesture1[i], gesture2[j]);
					if (d < min) { min = d; index = j; }
				}
			}
			matched[index] = true;
			sum += (1 - ((i - start + p1l) % p1l) / p1l) * min;
			i = (i + 1) % p1l;
		} while (i != start);
		return sum;
	},
	
	// Resamples a gesture in order to create gestures of homogenous lengths.  The second parameter indicates the length to which to resample the gesture.
	/**
	 * @param gesture
	 * @param newLength
	 * @returns {Array}
	 */
	resample: function (gesture, newLength) {
		var target = newLength - 1;
		var interval = this.pathLength(gesture)/target, dist = 0.0, resampledGesture = new Array(gesture[0]), d, p, pp, ppx, ppy, ppz, q;
		
		for (var i = 1, l = gesture.length; i < l; i++) {
			p	= gesture[i];
			pp	= gesture[i - 1];
			if (p.stroke == pp.stroke) {
				d = this.distance(pp, p);
				if ((dist + d) >= interval) {
					ppx = pp.x;
					ppy = pp.y;
					ppz = pp.z;
					q = new GestureMaker.Point((ppx + ((interval - dist) / d) * (p.x - ppx)),(ppy + ((interval - dist) / d) * (p.y - ppy)),(ppz + ((interval - dist) / d) * (p.z - ppz)), p.stroke);
					resampledGesture.push(q);
					gesture.splice(i, 0, q);
					dist = 0.0;
				} else { 
					dist += d;
				}
			}
		}
		if (resampledGesture.length != target) {
			p = gesture[gesture.length - 1];
			resampledGesture.push(new GestureMaker.Point(p.x, p.y, p.z, p.stroke));
		}
		return resampledGesture;
	},
	
	// Scales gestures to homogenous variances in order to provide for detection of the same gesture at different scales.
	/** 
	 * @param gesture
	 * @returns {Array}
	 */
	scale: function (gesture) {
		var minX = +Infinity, 
			maxX = -Infinity, 
			minY = +Infinity, 
			maxY = -Infinity,
			minZ = +Infinity, 
			maxZ = -Infinity,
			l = gesture.length,
			g, x, y, z, 
			min = Math.min,
			max = Math.max;
		
		for (var i = 0; i < l; i++) {
			g = gesture[i];
			x = g.x;
			y = g.y;
			z = g.z;
			minX = min(minX, x);
			minY = min(minY, y);
			minZ = min(minZ, z);
			maxX = max(maxX, x);
			maxY = max(maxY, y);
			maxZ = max(maxZ, z);
		}
		var size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

		for (var i = 0; i < l; i++) {
			g = gesture[i];
			gesture[i] = new GestureMaker.Point((g.x - minX)/size, (g.y - minY)/size, (g.z - minZ)/size, g.stroke);
		}

		return gesture;
	},

	// Translates a gesture to the provided centroid. 
	/** 
	 * @param gesture
	 * @param centroid
	 * @returns {Array}
	 */
	translateTo: function (gesture, centroid) {
		var center = this.centroid(gesture), g;

		for (var i = 0, l = gesture.length; i < l; i++) {
			g = gesture[i];
			gesture[i] = new GestureMaker.Point((g.x + centroid.x - center.x),(g.y + centroid.y - center.y),(g.z + centroid.z - center.z), g.stroke);								   
		}

		return gesture;
	},
	// Finds the center of a gesture by averaging the X and Y coordinates of all points in the gesture data.
	/**
	 * @param gesture
	 * @returns {GestureMaker.Point}
	 */
	centroid: function (gesture) {
		var x = 0.0, y = 0.0, z = 0.0, l = gesture.length, g;

		for (var i = 0; i < l; i++) {
			g = gesture[i];
			x += g.x;
			y += g.y;
			z += g.z;
		}
		return new GestureMaker.Point(x/l, y/l, z/l, 0);
	},
	
	// Calculates the average distance between corresponding points in two gestures
	/**
	 * @param gesture1
	 * @param gesture2
	 * @returns {Number}
	 */
	pathDistance: function (gesture1, gesture2) {
		var d = 0.0, l = gesture1.length;

		for (var i = 0; i < l; i++) { 
			d += this.distance(gesture1[i], gesture2[i]); 
		}
		return d/l;
	},
	
	// Calculates the length traversed by a single point in a gesture
	/**
	 * @param gesture
	 * @returns {Number}
	 */
	pathLength: function (gesture) {
		var d = 0.0, g, gg;

		for (var i = 1, l = gesture.length; i < l; i++) {
			g	= gesture[i];
			gg 	= gesture[i - 1];
			if (g.stroke == gg.stroke) { 
				d += this.distance(gg, g); 
			}
		}
		return d;
	},
	
	//A simple Euclidean distance function
	/**
	 * @param p1
	 * @param p2
	 * @returns
	 */
	distance: function (p1, p2) {
		var dx = p1.x - p2.x;
		var dy = p1.y - p2.y;
		var dz = p1.z - p2.z;

		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}	
});