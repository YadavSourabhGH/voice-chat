const socket = io();
let localStream;
let remoteStream;
let peerConnection;
const roomInput = document.getElementById('roomInput');
const callSection = document.getElementById('callSection');
const remoteAudio = document.getElementById('remoteAudio');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Register a new user
document.getElementById('registerBtn').onclick = () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${username}&password=${password}`
    }).then(res => res.text()).then(alert);
};

// Log in an existing user
document.getElementById('loginBtn').onclick = () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${username}&password=${password}`
    }).then(res => res.text()).then(response => {
        if (response.includes('successful')) {
            document.getElementById('authSection').style.display = 'none';
            callSection.style.display = 'block';
        }
        alert(response);
    });
};

// Generate a unique room ID if none is provided
function generateRoomId() {
    return 'room-' + Math.random().toString(36).substr(2, 9);
}

// Create a new room and generate the invite URL
document.getElementById('createRoom').onclick = () => {
    let room = roomInput.value || generateRoomId();  // Use input or generate a new room ID
    roomInput.value = room;  // Set the room ID in the input field
    socket.emit('join', room);
    startCall(room);
    displayInviteUrl(room);  // Display invite URL for sharing
};

// Display the invite URL for sharing
function displayInviteUrl(room) {
    const inviteUrl = `${window.location.origin}?room=${room}`;
    document.getElementById('inviteUrl').value = inviteUrl;
    document.getElementById('inviteSection').style.display = 'block';
}

// Copy the invite URL to clipboard
document.getElementById('copyUrl').onclick = () => {
    const inviteUrl = document.getElementById('inviteUrl');
    inviteUrl.select();
    document.execCommand('copy');
    alert('Invite URL copied to clipboard!');
};

// Check if there's a room in the URL when the page loads
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (room) {
        roomInput.value = room;
        startCall(room);
    }
};

// Join an existing room
document.getElementById('joinRoom').onclick = () => {
    const room = roomInput.value;
    socket.emit('join', room);
    startCall(room);
};

// Function to initiate a call
async function startCall(room) {
    callSection.style.display = 'block';
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection();

    // Add local audio stream to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // When remote audio stream is received, play it
    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteAudio.srcObject = remoteStream;
    };

    // Handle when another user joins the room
    socket.on('user joined', () => {
        peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            socket.emit('offer', { offer, room });
        });
    });

    // Receive an offer from another user and respond with an answer
    socket.on('offer', (offer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        peerConnection.createAnswer().then(answer => {
            peerConnection.setLocalDescription(answer);
            socket.emit('answer', { answer, room });
        });
    });

    // Set the remote answer
    socket.on('answer', (answer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Receive and add ICE candidates
    socket.on('ice-candidate', (candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Emit local ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, room });
        }
    };

    // Leave the call and stop the local stream
    document.getElementById('leaveCall').onclick = () => {
        if (confirm('Are you sure you want to leave the call?')) {
            localStream.getTracks().forEach(track => track.stop());
            socket.disconnect();
            callSection.style.display = 'none';
        }
    };

    // Mute/unmute the local audio
    document.getElementById('muteBtn').onclick = () => {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            document.getElementById('muteBtn').textContent = track.enabled ? 'Mute' : 'Unmute';
        });
    };
}
