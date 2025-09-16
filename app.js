// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const modeIndicator = document.getElementById('modeIndicator');
const modeText = document.getElementById('modeText');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');

// New DOM elements for yoga tracking
const poseNameEl = document.getElementById('poseName');
const poseConfidenceEl = document.getElementById('poseConfidence');
const poseTimerEl = document.getElementById('poseTimer');
const sessionTimeEl = document.getElementById('sessionTime');
const posesCompletedEl = document.getElementById('posesCompleted');
const totalHoldTimeEl = document.getElementById('totalHoldTime');
const poseButtons = document.querySelectorAll('.pose-btn');

// New UI elements for togglable sidebar
const sidebar = document.getElementById('poseSidebar');
const mainContent = document.getElementById('mainContent');
const sidebarToggleBtn = document.getElementById('sidebarToggle');

// State variables
let model;
let detector;
let isTracking = false;
let showVideo = true;
let timerInterval = null;

// Yoga tracking state
let currentPose = null;
let poseStartTime = null;
let sessionStartTime = null;
let posesCompleted = 0;
let totalHoldTime = 0;
let selectedPose = 'auto'; // 'auto', 'warrior1', 'tree', 'mountain'

// Yoga pose definitions and thresholds
const yogaPoses = {
  'warrior1': {
    name: 'Warrior I',
    instruction: 'Stand with feet hip-width apart, step one foot forward into a lunge, raise arms overhead with palms together.',
    keyPoints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee'],
    thresholds: {
      armAngle: 45, // Arms should be roughly vertical
      hipAngle: 30, // Hip alignment
      kneeAngle: 90  // Front knee should be at 90 degrees
    }
  },
  'tree': {
    name: 'Tree Pose',
    instruction: 'Stand on one leg, place the other foot on inner thigh or calf (avoid knee), bring hands to prayer position.',
    keyPoints: ['left_ankle', 'right_ankle', 'left_knee', 'right_knee', 'left_hip', 'right_hip'],
    thresholds: {
      balanceThreshold: 0.1, // How much the person can sway
      footPosition: 0.3 // Where the lifted foot should be relative to standing leg
    }
  },
  'mountain': {
    name: 'Mountain Pose',
    instruction: 'Stand tall with feet together, arms at sides, shoulders relaxed, spine straight.',
    keyPoints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    thresholds: {
      alignmentThreshold: 0.2, // How aligned the body should be
      armPosition: 0.1 // Arms should be close to sides
    }
  }
};

// Pose detection parameters
const poseConfidenceThreshold = 0.3;
const poseHoldTime = 2000; // Minimum time to hold pose (ms)

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
    
    modeText.textContent = "Camera Connected - Ready for Yoga Tracking";
    modeText.classList.add('camera-mode');
    
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


// Initialize the application
async function init() {
  try {
    await setupCamera();
    
    video.play();
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    await loadModel();
    
    startBtn.addEventListener('click', toggleTracking);
    resetBtn.addEventListener('click', resetSession);
    toggleVideoBtn.addEventListener('click', toggleVideoVisibility);
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    
    // Add pose selection event listeners
    poseButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all buttons
        poseButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        // Update selected pose
        selectedPose = btn.dataset.pose;
      });
    });
    
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
    errorBox.style.backgroundColor = 'rgba(255, 235, 238, 0.95)';
    errorBox.style.color = '#d32f2f';
    errorBox.style.padding = '20px';
    errorBox.style.margin = '20px 0';
    errorBox.style.borderRadius = '15px';
    errorBox.style.textAlign = 'center';
    errorBox.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
    errorBox.style.backdropFilter = 'blur(10px)';
    
    errorBox.innerHTML = `
      <h3>🧘‍♀️ Camera Required for Yoga Tracking</h3>
      <p>${error.message}</p>
      <p><strong>To use this yoga tracker:</strong></p>
      <ul style="text-align: left; display: inline-block;">
        <li>Make sure you're accessing via <strong>localhost</strong> or <strong>HTTPS</strong></li>
        <li>Try using Chrome, Firefox, or Edge (latest versions)</li>
        <li>Grant camera permissions when prompted</li>
        <li>Check if your camera is working in other applications</li>
        <li>Ensure good lighting for pose detection</li>
      </ul>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(errorBox, container.firstChild);
  }
}

// Toggle sidebar visibility
function toggleSidebar() {
  sidebar.classList.toggle('sidebar--hidden');
  mainContent.classList.toggle('sidebar--hidden');
}

// Toggle yoga tracking
function toggleTracking() {
  isTracking = !isTracking;
  startBtn.textContent = isTracking ? 'Pause Session' : 'Start Session';
  
  if (isTracking) {
    sessionStartTime = Date.now();
    timerInterval = setInterval(updateYogaDisplay, 1000);
    detectPose();
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Reset yoga session
function resetSession() {
  isTracking = false;
  startBtn.textContent = 'Start Session';
  posesCompleted = 0;
  totalHoldTime = 0;
  currentPose = null;
  poseStartTime = null;
  sessionStartTime = null;
  updateYogaDisplay();
}

// Update the yoga tracking display
function updateYogaDisplay() {
  posesCompletedEl.textContent = posesCompleted;
  
  // Update session time
  if (sessionStartTime) {
    const sessionElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    sessionTimeEl.textContent = formatTime(sessionElapsed);
  } else {
    sessionTimeEl.textContent = '00:00';
  }
  
  // Update total hold time
  totalHoldTimeEl.textContent = formatTime(Math.floor(totalHoldTime / 1000));
  
  // Update pose timer
  if (poseStartTime && currentPose) {
    const poseElapsed = Math.floor((Date.now() - poseStartTime) / 1000);
    poseTimerEl.textContent = formatTime(poseElapsed);
  } else {
    poseTimerEl.textContent = '00:00';
  }
}

// Format time in MM:SS format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Detect yoga poses
function detectYogaPose(poses) {
  if (!poses || poses.length === 0) return;
  
  const pose = poses[0];
  const keypoints = pose.keypoints;
  
  // Get all keypoints with sufficient confidence
  const validKeypoints = keypoints.filter(kp => kp.score > poseConfidenceThreshold);
  
  if (validKeypoints.length < 8) {
    // Not enough keypoints detected
    if (currentPose) {
      currentPose = null;
      poseStartTime = null;
      updatePoseDisplay(null, 0);
    }
    return;
  }
  
  // Classify the pose
  const detectedPose = classifyPose(keypoints);
  const confidence = calculatePoseConfidence(keypoints, detectedPose);
  
  // Update pose display
  updatePoseDisplay(detectedPose, confidence);
  
  // Handle pose timing
  handlePoseTiming(detectedPose, confidence);
}

// Classify yoga pose based on keypoint positions and angles
function classifyPose(keypoints) {
  const keypointMap = {};
  keypoints.forEach(kp => {
    if (kp.score > poseConfidenceThreshold) {
      keypointMap[kp.name] = kp;
    }
  });
  
  // Check for Mountain Pose (standing straight)
  if (isMountainPose(keypointMap)) {
    return 'mountain';
  }
  
  // Check for Tree Pose (one leg lifted)
  if (isTreePose(keypointMap)) {
    return 'tree';
  }
  
  // Check for Warrior I (lunge with arms up)
  if (isWarrior1Pose(keypointMap)) {
    return 'warrior1';
  }
  
  return 'unknown';
}

// Check if pose matches Mountain Pose
function isMountainPose(keypoints) {
  const required = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
  if (!required.every(kp => keypoints[kp])) return false;
  
  // Check if shoulders and hips are roughly aligned
  const shoulderDiff = Math.abs(keypoints.left_shoulder.x - keypoints.right_shoulder.x);
  const hipDiff = Math.abs(keypoints.left_hip.x - keypoints.right_hip.x);
  
  return shoulderDiff < 50 && hipDiff < 50;
}

// Check if pose matches Tree Pose
function isTreePose(keypoints) {
  const required = ['left_ankle', 'right_ankle', 'left_knee', 'right_knee'];
  if (!required.every(kp => keypoints[kp])) return false;
  
  // Check if one ankle is significantly higher than the other
  const ankleHeightDiff = Math.abs(keypoints.left_ankle.y - keypoints.right_ankle.y);
  return ankleHeightDiff > 30;
}

// Check if pose matches Warrior I
function isWarrior1Pose(keypoints) {
  const required = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee'];
  if (!required.every(kp => keypoints[kp])) return false;
  
  // Check if arms are raised (shoulders higher than hips)
  const leftArmRaised = keypoints.left_shoulder.y < keypoints.left_hip.y - 20;
  const rightArmRaised = keypoints.right_shoulder.y < keypoints.right_hip.y - 20;
  
  // Check if one knee is significantly forward (lunge position)
  const kneeForwardDiff = Math.abs(keypoints.left_knee.x - keypoints.right_knee.x);
  
  return (leftArmRaised || rightArmRaised) && kneeForwardDiff > 40;
}

// Calculate confidence score for detected pose
function calculatePoseConfidence(keypoints, poseType) {
  if (poseType === 'unknown') return 0;
  
  const pose = yogaPoses[poseType];
  if (!pose) return 0;
  
  // Simple confidence calculation based on keypoint visibility
  const requiredKeypoints = pose.keyPoints;
  const visibleKeypoints = requiredKeypoints.filter(name => {
    const kp = keypoints.find(k => k.name === name);
    return kp && kp.score > poseConfidenceThreshold;
  });
  
  return Math.round((visibleKeypoints.length / requiredKeypoints.length) * 100);
}

// Update pose display information
function updatePoseDisplay(poseType, confidence) {
  if (poseType === 'unknown' || confidence < 30) {
    poseNameEl.textContent = 'Detecting...';
    poseConfidenceEl.textContent = '0%';
    poseConfidenceEl.style.color = '#666';
  } else {
    const poseName = yogaPoses[poseType] ? yogaPoses[poseType].name : poseType;
    poseNameEl.textContent = poseName;
    poseConfidenceEl.textContent = `${confidence}%`;
    
    // Color code confidence
    if (confidence >= 80) {
      poseConfidenceEl.style.color = '#4CAF50'; // Green
    } else if (confidence >= 60) {
      poseConfidenceEl.style.color = '#FF9800'; // Orange
    } else {
      poseConfidenceEl.style.color = '#f44336'; // Red
    }
  }
}

// Handle pose timing and completion tracking
function handlePoseTiming(poseType, confidence) {
  const now = Date.now();
  
  // If we detected a new pose or lost the current pose
  if (poseType !== currentPose) {
    // Complete previous pose if it was held long enough
    if (currentPose && poseStartTime && (now - poseStartTime) > poseHoldTime) {
      posesCompleted++;
      totalHoldTime += (now - poseStartTime);
    }
    
    // Start new pose if confidence is high enough
    if (poseType !== 'unknown' && confidence >= 60) {
      currentPose = poseType;
      poseStartTime = now;
    } else {
      currentPose = null;
      poseStartTime = null;
    }
  }
  
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
    if (keypoint.score > poseConfidenceThreshold) {
      ctx.beginPath();
      ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
      
      // Use different colors for different body parts
      if (keypoint.name.includes('shoulder') || keypoint.name.includes('elbow') || keypoint.name.includes('wrist')) {
        ctx.fillStyle = '#4CAF50'; // Green for arms
      } else if (keypoint.name.includes('hip') || keypoint.name.includes('knee') || keypoint.name.includes('ankle')) {
        ctx.fillStyle = '#2196F3'; // Blue for legs
      } else {
        ctx.fillStyle = '#FF9800'; // Orange for torso/head
      }
      
      ctx.fill();
      
      // Add white border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  
  // Draw lines connecting keypoints (full body skeleton)
  const connectedParts = [
    // Arms
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    // Torso
    ['left_shoulder', 'right_shoulder'],
    ['left_hip', 'right_hip'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    // Legs
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle']
  ];
  
  connectedParts.forEach(pair => {
    const part1 = pose.keypoints.find(k => k.name === pair[0]);
    const part2 = pose.keypoints.find(k => k.name === pair[1]);
    
    if (part1 && part2 && part1.score > poseConfidenceThreshold && part2.score > poseConfidenceThreshold) {
      ctx.beginPath();
      ctx.moveTo(part1.x, part1.y);
      ctx.lineTo(part2.x, part2.y);
      ctx.lineWidth = 3;
      
      // Different colors for different body parts
      if (pair[0].includes('shoulder') || pair[0].includes('elbow') || pair[0].includes('wrist')) {
        ctx.strokeStyle = '#4CAF50'; // Green for arms
      } else if (pair[0].includes('hip') || pair[0].includes('knee') || pair[0].includes('ankle')) {
        ctx.strokeStyle = '#2196F3'; // Blue for legs
      } else {
        ctx.strokeStyle = '#FF9800'; // Orange for torso
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
      detectYogaPose(poses);
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