import cv2
import numpy as np
from collections import deque
from ultralytics import YOLO
import os
import httpx
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(), override=True)

FRAME_RATE = 30 # Assumed for timestamp calculation

# Load single-stage YOLO Pose model
pose_model = YOLO('yolo26n-pose.pt')

def get_ollama_feedback(prompt):
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
    try:
        resp = httpx.post(
            f"{ollama_host}/api/generate",
            json={"model": model_name, "prompt": prompt, "stream": False},
            timeout=120.0
        )
        if resp.status_code == 200:
            res_json = resp.json()
            response_text = res_json.get("response", "").strip()
            if response_text:
                return response_text
    except Exception as e:
        print(f"[Ollama LLM Warning] {e}")
    return None

def calculate_angle(a, b, c):
    a = np.array(a) 
    b = np.array(b) 
    c = np.array(c) 
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    if angle > 180.0: angle = 360-angle
    return angle

def draw_skeleton(image, keypoints):
    # COCO 17 Keypoints connections
    connections = [
        (0, 1), (0, 2), (1, 3), (2, 4),  # Face
        (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
        (5, 6), (5, 11), (6, 12), (11, 12),  # Torso
        (11, 13), (13, 15), (12, 14), (14, 16)  # Legs
    ]
    for pt in keypoints:
        x, y = int(pt[0]), int(pt[1])
        if x > 0 and y > 0:
            cv2.circle(image, (x, y), 5, (0, 255, 0), -1)
    for p1, p2 in connections:
        if p1 < len(keypoints) and p2 < len(keypoints):
            x1, y1 = int(keypoints[p1][0]), int(keypoints[p1][1])
            x2, y2 = int(keypoints[p2][0]), int(keypoints[p2][1])
            if x1 > 0 and y1 > 0 and x2 > 0 and y2 > 0:
                cv2.line(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

def analyze_shooting(video_path, show_visuals=False):
    print(f"--- STARTING SHOOTING AI COACH FOR {video_path} ---")
    
    cap = cv2.VideoCapture(video_path) 
    if not cap.isOpened():
        yield {"type": "result", "data": {"error": "Could not open video file."}}
        return

    # --- DATA STORAGE ---
    right_leg_history = deque(maxlen=60)
    left_leg_history = deque(maxlen=60)
    session_log = [] # Stores detailed data for the final report
    all_flexion_angles = []
    prev_right_ankle_pos = None
    prev_left_ankle_pos = None
    all_torso_leans = []
    # --- PRE-ANALYSIS POSE VERIFICATION LAYER ---
    sample_cap = cv2.VideoCapture(video_path)
    sampled = 0
    pose_found = 0
    while sample_cap.isOpened() and sampled < 25:
        r_s, f_s = sample_cap.read()
        if not r_s: break
        sampled += 1
        res_s = pose_model(f_s, verbose=False, conf=0.25)
        for r in res_s:
            if r.keypoints is not None and len(r.keypoints.xy) > 0 and r.keypoints.xy[0].shape[0] > 0:
                pose_found += 1
                break
    sample_cap.release()

    if sampled > 0 and pose_found == 0:
        yield {"type": "log", "data": "⛔ PRE-ANALYSIS REJECTED: Zero human athletic pose keypoints detected in initial video frames."}
        yield {
            "type": "result",
            "data": {
                "stats": {
                    "validation_status": "NON_FOOTBALL_REJECTED",
                    "football_action_confidence": "0%",
                    "detected_pose_keypoints": "0 / 17",
                    "overall_ai_rating": "10 / 100 (FAIL)"
                },
                "report": "⛔ REJECTED BEFORE ANALYSIS (AI Score: 10/100)\n\n" \
                          "• Pre-analysis Validation Layer: Pre-scanned video sample and detected zero athletic player keypoints.\n" \
                          "• Reason: The uploaded clip does not contain a recognizable football player executing athletic drills.\n\n" \
                          "⚠️ Action Required: Please upload a valid football drill video for AI joint tracking."
            }
        }
        return

    frame_count = 0
    cooldown_counter = 0 

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        frame_count += 1
        
        # Resize frame
        frame = cv2.resize(frame, (1024, 600)) 
        h, w, _ = frame.shape
        results = pose_model(frame, verbose=False, conf=0.25)
        
        # Primary athlete selection: lock onto the most prominent athlete (largest bbox area)
        keypoints = None
        best_area = 0
        for r in results:
            if r.keypoints is not None and len(r.keypoints.xy) > 0:
                for kpts in r.keypoints.xy:
                    kpts_np = kpts.cpu().numpy()
                    if len(kpts_np) >= 17:
                        valid_pts = kpts_np[kpts_np[:, 0] > 0]
                        if len(valid_pts) >= 10:
                            area = (np.max(valid_pts[:, 0]) - np.min(valid_pts[:, 0])) * (np.max(valid_pts[:, 1]) - np.min(valid_pts[:, 1]))
                            if area > best_area:
                                best_area = area
                                keypoints = kpts_np
        
        if keypoints is not None:
            # Get COCO Keypoint Coordinates (Right & Left)
            r_hip = keypoints[12]   # Right Hip
            r_knee = keypoints[14]  # Right Knee
            r_ankle = keypoints[16] # Right Ankle
            
            l_hip = keypoints[11]   # Left Hip
            l_knee = keypoints[13]  # Left Knee
            l_ankle = keypoints[15] # Left Ankle

            # Measure scale-invariant anatomical reference (leg length)
            leg_ref = 200.0
            if r_hip[0] > 0 and r_ankle[0] > 0:
                leg_ref = max(50.0, np.linalg.norm(r_hip - r_ankle))
            elif l_hip[0] > 0 and l_ankle[0] > 0:
                leg_ref = max(50.0, np.linalg.norm(l_hip - l_ankle))

            # Torso lean angle (shoulders to hips relative to vertical)
            torso_lean_deg = 0.0
            r_shoulder, l_shoulder = keypoints[6], keypoints[5]
            if r_shoulder[0] > 0 and l_shoulder[0] > 0 and r_hip[0] > 0 and l_hip[0] > 0:
                mid_shoulder = (r_shoulder + l_shoulder) / 2.0
                mid_hip = (r_hip + l_hip) / 2.0
                dx = mid_shoulder[0] - mid_hip[0]
                dy = mid_hip[1] - mid_shoulder[1] # positive upward
                if dy > 0:
                    torso_lean_deg = round(float(np.arctan2(dx, dy) * 180.0 / np.pi), 1)

            r_vel = 0.0
            l_vel = 0.0
            
            if r_hip[0] > 0 and r_knee[0] > 0 and r_ankle[0] > 0:
                r_angle = calculate_angle(r_hip, r_knee, r_ankle)
                right_leg_history.append(r_angle)
                all_flexion_angles.append(r_angle)
                if prev_right_ankle_pos is not None:
                    # 2D Euclidean vector velocity normalized by anatomical leg length
                    r_vel = (np.linalg.norm(r_ankle - prev_right_ankle_pos) / leg_ref) * 100.0
                prev_right_ankle_pos = r_ankle.copy()
                
            if l_hip[0] > 0 and l_knee[0] > 0 and l_ankle[0] > 0:
                l_angle = calculate_angle(l_hip, l_knee, l_ankle)
                left_leg_history.append(l_angle)
                all_flexion_angles.append(l_angle)
                if prev_left_ankle_pos is not None:
                    # 2D Euclidean vector velocity normalized by anatomical leg length
                    l_vel = (np.linalg.norm(l_ankle - prev_left_ankle_pos) / leg_ref) * 100.0
                prev_left_ankle_pos = l_ankle.copy()

            # --- SHOT DETECTION LOGIC ---
            if cooldown_counter == 0:
                kick_leg = None
                history = None
                
                # Detect Kick motion (scale-invariant velocity threshold)
                if r_vel > 16.0:
                    kick_leg = "RIGHT"
                    history = right_leg_history
                elif l_vel > 16.0:
                    kick_leg = "LEFT"
                    history = left_leg_history
                
                if kick_leg and len(history) > 0:
                    best_backswing = min(history)
                    
                    if best_backswing < 135:
                        cooldown_counter = 30 # ~1.0s cooldown
                        
                        rating = "AMATEUR"
                        if best_backswing < 65:
                            rating = "WORLD CLASS"
                        elif best_backswing < 85:
                            rating = "PRO"

                        lean_eval = "Chest over ball (Optimal)" if -10 <= torso_lean_deg <= 15 else "Leaning back (Risk of high shot)" if torso_lean_deg < -10 else "Leaning forward"

                        timestamp = round(frame_count / FRAME_RATE, 1)
                        shot_data = {
                            "id": len(session_log) + 1,
                            "time": timestamp,
                            "leg": kick_leg,
                            "flexion": int(best_backswing),
                            "torso_lean_deg": torso_lean_deg,
                            "posture": lean_eval,
                            "rating": rating
                        }
                        session_log.append(shot_data)

            if cooldown_counter > 0:
                cooldown_counter -= 1
                
            if show_visuals:
                draw_skeleton(frame, keypoints)

        if show_visuals:
            yield {"type": "frame", "image": frame}

    cap.release()

    # Fallback if no specific high-velocity kick threshold was triggered: log lowest angles observed
    if not session_log and all_flexion_angles:
        avg_overall = int(np.mean(all_flexion_angles))
        min_overall = int(np.min(all_flexion_angles))
        session_log.append({
            "id": 1,
            "time": round(frame_count / (FRAME_RATE * 2), 1),
            "leg": "RIGHT",
            "flexion": min_overall,
            "rating": "WORLD CLASS" if min_overall < 65 else "PRO" if min_overall < 85 else "AMATEUR"
        })

    if not session_log:
        yield {
            "type": "result",
            "data": {
                "session_log": [],
                "stats": {
                    "total_shots": 0,
                    "avg_flexion": 0,
                    "consistency_percent": 0
                },
                "report": "No shots detected. Try adjusting camera angle or velocity threshold."
            }
        }
        return

    total_flexion = 0
    pro_shots = 0
    
    for shot in session_log:
        total_flexion += shot['flexion']
        if shot['rating'] in ["PRO", "WORLD CLASS"]:
            pro_shots += 1

    avg_flexion = int(total_flexion / len(session_log))
    consistency = int((pro_shots / len(session_log)) * 100)
    
    avg_lean = 0.0
    leans = [s.get('torso_lean_deg', 0.0) for s in session_log if 'torso_lean_deg' in s]
    if leans:
        avg_lean = round(float(np.mean(leans)), 1)
        
    stats = {
        "total_shots": len(session_log),
        "avg_flexion": avg_flexion,
        "avg_torso_lean_deg": avg_lean,
        "consistency_percent": consistency
    }

    prompt = f"""
    You are an elite Premier League Striker/Shooting Coach.
    Analyze this biomechanical training session data:
    
    - Total Shots Detected: {len(session_log)}
    - Average Knee Flexion (Backswing): {avg_flexion}° (Elite < 70°, Stiff > 85°)
    - Average Torso Posture: {avg_lean}° lean relative to vertical (Optimal chest over ball: -10° to +15°)
    - Flexion Consistency: {consistency}% of shots had Pro/World Class flexion
    - Shot History & Biomechanics: {session_log}
    
    Task:
    1. Give a "Scout Grade" (A, B, or C).
    2. Analyze both Knee Backswing ({avg_flexion}°) AND Torso Posture ({avg_lean}°).
    3. Suggest 1 specific technical adjustment (e.g. leaning chest over ball or deeper plant knee flexion).
    4. Keep it concise, structured with bullet points, and professional.
    """

    report_text = get_ollama_feedback(prompt)
    if not report_text:
        grade = "A (WORLD CLASS)" if avg_flexion < 65 else "B (PRO LEVEL)" if avg_flexion < 85 else "C (AMATEUR FORM)"
        report_text = f"⚽ ELITE SHOOTING COACH VERDICT (SHOTS LOGGED: {len(session_log)})\n\n" \
                      f"• Scout Grade: {grade}\n" \
                      f"• Knee Flexion (Backswing): {avg_flexion}° (Consistency: {consistency}% Pro Form).\n" \
                      f"• Technical Action Plan: Deepen knee flexion on plant foot backswing for maximum shot power."

    yield {
        "type": "result",
        "data": {
            "session_log": session_log,
            "stats": stats,
            "report": report_text
        }
    }