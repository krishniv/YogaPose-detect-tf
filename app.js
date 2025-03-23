// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const leftCountEl = document.getElementById('leftCount');
const rightCountEl = document.getElementById('rightCount');
const totalCountEl = document.getElementById('totalCount');
const modeIndicator = document.getElementById('modeIndicator');
const modeText = document.getElementById('modeText');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');

// State variables
let model;
let detector;
let isTracking = false;
let leftPunchCount = 0;
let rightPunchCount = 0;
let showVideo = true;

// Punch detection parameters
let prevLeftWristPosition = null;
let prevRightWristPosition = null;
let leftPunchState = 'ready'; // 'ready', 'extended', 'retracting'
let rightPunchState = 'ready';
const punchThreshold = 0.15; // Movement threshold to detect a punch
const punchCooldown = 300; // Minimum time (ms) between punch detections
let lastLeftPunchTime = 0;
let lastRightPunchTime = 0;

// Setup the video stream from webcam
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser API navigator.mediaDevices.getUserMedia not available. Please try a different browser or ensure you\'re using HTTPS/localhost.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    video.srcObject = stream;
    
    // Add debug info to confirm webcam is working
    console.log("Camera connected successfully. Resolution:", video.videoWidth, "x", video.videoHeight);
    
    modeText.textContent = "Camera Mode - Using Webcam";
    modeText.classList.add('camera-mode');
    modeText.classList.remove('demo-mode');
    
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        // Make sure video dimensions are properly set
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log("Video dimensions set to:", canvas.width, "x", canvas.height);
        resolve(video);
      };
    });
  } catch (error) {
    console.error('Failed to access webcam:', error.message);
    throw new Error('Failed to access webcam. Please ensure camera permissions are granted and your camera is working properly.');
  }
}

// Load the MoveNet model
async function loadModel() {
  const detectorConfig = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true
  };
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet, 
    detectorConfig
  );
  console.log('Model loaded successfully');
}

// Add this function to app.js
async function setupDemoVideo() {
  // Create a dummy canvas as the video source
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = 640;
  dummyCanvas.height = 480;
  const dummyCtx = dummyCanvas.getContext('2d');
  
  // Draw something on the canvas
  dummyCtx.fillStyle = '#333';
  dummyCtx.fillRect(0, 0, dummyCanvas.width, dummyCanvas.height);
  dummyCtx.fillStyle = 'white';
  dummyCtx.font = '24px Arial';
  dummyCtx.fillText('DEMO MODE - No camera access', 180, 240);
  
  // Convert canvas to MediaStream
  const stream = dummyCanvas.captureStream();
  video.srcObject = stream;
  
  modeText.textContent = "DEMO MODE - No camera access";
  modeText.classList.add('demo-mode');
  modeText.classList.remove('camera-mode');
  
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

// Initialize the application
async function init() {
  try {
    try {
      await setupCamera();
    } catch (cameraError) {
      console.warn('Camera access failed, using demo mode:', cameraError);
      await setupDemoVideo();
    }
    
    video.play();
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    await loadModel();
    
    startBtn.addEventListener('click', toggleTracking);
    resetBtn.addEventListener('click', resetCounters);
    toggleVideoBtn.addEventListener('click', toggleVideoVisibility);
    
    console.log('App initialized successfully');
    console.log("Video source type:", video.srcObject ? "Connected" : "Not connected");
    if (video.srcObject instanceof MediaStream) {
      const tracks = video.srcObject.getVideoTracks();
      console.log("Video tracks:", tracks.length);
      if (tracks.length > 0) {
        console.log("Active track:", tracks[0].label, "enabled:", tracks[0].enabled);
      }
    }
    
    // Force video to be visible
    video.style.display = 'block';
    video.style.opacity = '1';
    canvas.style.backgroundColor = 'transparent';
  } catch (error) {
    console.error('Error initializing app:', error);
    
    // Create error message element
    const errorBox = document.createElement('div');
    errorBox.style.backgroundColor = '#ffebee';
    errorBox.style.color = '#d32f2f';
    errorBox.style.padding = '20px';
    errorBox.style.margin = '20px 0';
    errorBox.style.borderRadius = '5px';
    errorBox.style.textAlign = 'center';
    
    errorBox.innerHTML = `
      <h3>Error Starting Application</h3>
      <p>${error.message}</p>
      <p>Common solutions:</p>
      <ul style="text-align: left; display: inline-block;">
        <li>Make sure you're accessing via <strong>localhost</strong> or <strong>HTTPS</strong></li>
        <li>Try using Chrome, Firefox, or Edge (latest versions)</li>
        <li>Grant camera permissions when prompted</li>
        <li>Check if your camera is working in other applications</li>
      </ul>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(errorBox, container.firstChild);
  }
}

// Toggle punch tracking
function toggleTracking() {
  isTracking = !isTracking;
  startBtn.textContent = isTracking ? 'Pause Tracking' : 'Start Tracking';
  
  if (isTracking) {
    detectPose();
  }
}

// Reset punch counters
function resetCounters() {
  leftPunchCount = 0;
  rightPunchCount = 0;
  updateCounterDisplay();
}

// Update the counter display
function updateCounterDisplay() {
  leftCountEl.textContent = leftPunchCount;
  rightCountEl.textContent = rightPunchCount;
  totalCountEl.textContent = leftPunchCount + rightPunchCount;
}

// Detect if a punch has been thrown
function detectPunch(poses) {
  if (!poses || poses.length === 0) return;
  
  const pose = poses[0];
  const keypoints = pose.keypoints;
  
  const leftWrist = keypoints.find(k => k.name === 'left_wrist');
  const rightWrist = keypoints.find(k => k.name === 'right_wrist');
  const leftElbow = keypoints.find(k => k.name === 'left_elbow');
  const rightElbow = keypoints.find(k => k.name === 'right_elbow');
  const leftShoulder = keypoints.find(k => k.name === 'left_shoulder');
  const rightShoulder = keypoints.find(k => k.name === 'right_shoulder');
  
  // Skip if key points aren't detected with enough confidence
  if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || 
      !leftShoulder || !rightShoulder || 
      leftWrist.score < 0.3 || rightWrist.score < 0.3) {
    prevLeftWristPosition = null;
    prevRightWristPosition = null;
    return;
  }
  
  const now = Date.now();
  
  // Process left hand punch
  if (prevLeftWristPosition) {
    // Calculate z-movement (approximated by measuring change in x-position relative to shoulder)
    const leftShoulderToWristX = leftWrist.x - leftShoulder.x;
    const prevLeftShoulderToWristX = prevLeftWristPosition.x - leftShoulder.x;
    const leftZMovement = leftShoulderToWristX - prevLeftShoulderToWristX;
    
    // State machine for punch detection
    switch (leftPunchState) {
      case 'ready':
        if (leftZMovement < -punchThreshold && now - lastLeftPunchTime > punchCooldown) {
          leftPunchState = 'extended';
        }
        break;
      case 'extended':
        if (leftZMovement > punchThreshold) {
          leftPunchState = 'retracting';
        }
        break;
      case 'retracting':
        if (Math.abs(leftZMovement) < punchThreshold/2) {
          leftPunchCount++;
          updateCounterDisplay();
          leftPunchState = 'ready';
          lastLeftPunchTime = now;
        }
        break;
    }
  }
  
  // Process right hand punch
  if (prevRightWristPosition) {
    // Calculate z-movement (approximated by measuring change in x-position relative to shoulder)
    const rightShoulderToWristX = rightWrist.x - rightShoulder.x;
    const prevRightShoulderToWristX = prevRightWristPosition.x - rightShoulder.x;
    const rightZMovement = rightShoulderToWristX - prevRightShoulderToWristX;
    
    // State machine for punch detection
    switch (rightPunchState) {
      case 'ready':
        if (rightZMovement < -punchThreshold && now - lastRightPunchTime > punchCooldown) {
          rightPunchState = 'extended';
        }
        break;
      case 'extended':
        if (rightZMovement > punchThreshold) {
          rightPunchState = 'retracting';
        }
        break;
      case 'retracting':
        if (Math.abs(rightZMovement) < punchThreshold/2) {
          rightPunchCount++;
          updateCounterDisplay();
          rightPunchState = 'ready';
          lastRightPunchTime = now;
        }
        break;
    }
  }
  
  // Store current positions for next frame
  prevLeftWristPosition = { x: leftWrist.x, y: leftWrist.y };
  prevRightWristPosition = { x: rightWrist.x, y: rightWrist.y };
}

// Draw pose keypoints and lines on canvas
function drawPose(pose) {
  if (!canvas || !ctx) {
    console.error("Canvas or context not available for drawing");
    return;
  }
  
  // Ensure canvas dimensions match video
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    console.log("Resizing canvas to match video:", video.videoWidth, "x", video.videoHeight);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  
  // Clear the canvas completely before drawing new content
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Make canvas transparent to see video underneath
  canvas.style.backgroundColor = 'transparent';
  
  // Draw a semi-transparent border instead of solid
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  if (!pose || !pose.keypoints) return;
  
  // Draw keypoints
  pose.keypoints.forEach(keypoint => {
    if (keypoint.score > 0.3) {
      ctx.beginPath();
      ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
      
      // Use different colors for left and right wrists to visualize punches
      if (keypoint.name === 'left_wrist') {
        ctx.fillStyle = leftPunchState === 'extended' ? 'red' : 'green';
      } else if (keypoint.name === 'right_wrist') {
        ctx.fillStyle = rightPunchState === 'extended' ? 'red' : 'blue';
      } else {
        ctx.fillStyle = 'yellow';
      }
      
      ctx.fill();
    }
  });
  
  // Draw lines connecting keypoints (for arms)
  const connectedParts = [
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist']
  ];
  
  connectedParts.forEach(pair => {
    const part1 = pose.keypoints.find(k => k.name === pair[0]);
    const part2 = pose.keypoints.find(k => k.name === pair[1]);
    
    if (part1 && part2 && part1.score > 0.3 && part2.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(part1.x, part1.y);
      ctx.lineTo(part2.x, part2.y);
      ctx.lineWidth = 2;
      
      // Different colors for left and right arms
      if (pair[0].includes('left')) {
        ctx.strokeStyle = 'green';
      } else {
        ctx.strokeStyle = 'blue';
      }
      
      ctx.stroke();
    }
  });
}

// Main pose detection loop
async function detectPose() {
  if (!isTracking) return;
  
  try {
    const poses = await detector.estimatePoses(video);
    
    if (poses && poses.length > 0) {
      detectPunch(poses);
      drawPose(poses[0]);
    }
    
    requestAnimationFrame(detectPose);
  } catch (error) {
    console.error('Error detecting pose:', error);
  }
}

// Toggle video visibility
function toggleVideoVisibility() {
  showVideo = !showVideo;
  
  if (showVideo) {
    // Show video under transparent canvas
    video.style.opacity = '1';
    canvas.style.backgroundColor = 'transparent';
    toggleVideoBtn.textContent = 'Hide Video';
  } else {
    // Hide video, show just pose on black background
    video.style.opacity = '0';
    canvas.style.backgroundColor = '#333';
    toggleVideoBtn.textContent = 'Show Video';
  }
}

// Make sure video is visible by default
window.addEventListener('load', () => {
  // Initialize with video visible
  video.style.opacity = '1';
  canvas.style.backgroundColor = 'transparent';
  toggleVideoBtn.textContent = 'Hide Video';
});

// Start the app when the page loads
window.addEventListener('load', init); 