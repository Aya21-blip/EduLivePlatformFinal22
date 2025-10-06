const socket = io();
const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
let localTracks = [];
let remoteUsers = {};
const APP_ID = "YOUR_AGORA_APP_ID"; // ← غيّري هذا إلى App ID الحقيقي
const CHANNEL = "classroom";
let NAME = "";

document.addEventListener("DOMContentLoaded", () => {
  if (typeof role === "undefined") return;

  if (role === "teacher") {
    document.getElementById("startBtn").onclick = startBroadcast;
    document.getElementById("stopBtn").onclick = leaveChannel;

    socket.on("studentListUpdate", ({ studentId, name }) => {
      updateStudentList(studentId, name);
    });

    socket.on("micRequested", ({ studentId, name }) => {
      showMicRequest(studentId, name);
    });
  }

  if (role === "student") {
    document.getElementById("joinBtn").onclick = joinAsAudience;
    document.getElementById("micRequestBtn").onclick = () => {
      socket.emit("requestMic", { name: NAME });
    };

    socket.on("micApproved", async () => {
      await enableMic();
    });
  }
});

// === المعلم يبدأ البث ===
async function startBroadcast() {
  await joinChannel("host");
  localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();

  localTracks.forEach(track => {
    track.play("videoContainer");
    client.publish(track);
  });

  console.log("✅ بدء البث...");
}

// === الطالب ينضم كمشاهد ===
async function joinAsAudience() {
  NAME = document.getElementById("studentName").value.trim();
  if (!NAME) return alert("يرجى إدخال اسمك");

  await joinChannel("audience");
  document.getElementById("micRequestBtn").disabled = false;

  socket.emit("join-student", { name: NAME });

  client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === "video") {
      const remoteVideo = document.createElement("div");
      remoteVideo.id = user.uid;
      document.getElementById("videoContainer").appendChild(remoteVideo);
      user.videoTrack.play(remoteVideo);
    }
    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  });

  client.on("user-unpublished", user => {
    document.getElementById(user.uid)?.remove();
  });
}

// === انضمام للقناة ===
async function joinChannel(clientRole) {
  client.setClientRole(clientRole);

  const tokenRes = await fetch(`/rtc-token?channel=${CHANNEL}`);
  const data = await tokenRes.json();

  await client.join(APP_ID, CHANNEL, data.token || null, null);
}

// === تفعيل مايك الطالب ===
async function enableMic() {
  const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
  await client.publish([micTrack]);
  console.log("🎤 تم تفعيل المايك");
}

// === الخروج من القناة ===
async function leaveChannel() {
  for (const track of localTracks) {
    track.stop();
    track.close();
  }
  await client.leave();
  document.getElementById("videoContainer").innerHTML = "";
}

// === تحديث قائمة الطلاب في صفحة المعلم ===
function updateStudentList(studentId, name) {
  const list = document.getElementById("studentsList");
  const exists = document.getElementById(`student-${studentId}`);
  if (exists) return;

  const li = document.createElement("li");
  li.id = `student-${studentId}`;
  li.textContent = name;
  list.appendChild(li);
}

// === عرض رمز الطلب بجانب اسم الطالب ===
function showMicRequest(studentId, name) {
  const li = document.getElementById(`student-${studentId}`);
  if (!li) return;

  li.innerHTML = `${name} 🔔`;
  li.style.cursor = "pointer";
  li.onclick = () => {
    socket.emit("approveMic", { studentId });
    li.innerHTML = `${name} 🎤`;
    li.style.cursor = "default";
    li.onclick = null;
  };
}

