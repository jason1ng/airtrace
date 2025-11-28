import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import "../global.css"; 

// Import Firestore
import { db } from "../../contexts/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function Signup() {
  const usernameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
  const addressRef = useRef();
  const diseaseRef = useRef(); 

  const { signup } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      return setError("Passwords do not match");
    }

    try {
      setError("");
      setLoading(true);

      // Create the Authentication Account (Email/Pass)
      const userCredential = await signup(emailRef.current.value, passwordRef.current.value);
      const user = userCredential.user;

      // Save the extra data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        username: usernameRef.current.value,
        email: emailRef.current.value,
        home_address: addressRef.current.value,    
        disease: diseaseRef.current.value,       
        createdAt: new Date().toISOString()
      });

      console.log("User data saved to Firestore!");
      navigate("/map");
    } catch (err) {
      console.error(err);
      setError("Failed to create an account: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      {/* Left Side - Branding */}
      <div className="auth-branding">
        <h1>AirTrace</h1>
        <p>Join the community for healthier travel routes.</p>
      </div>

      {/* Right Side - Form */}
      <div className="auth-form-container">
        <div className="auth-form-box" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <h2>Create Account</h2>
          {error && <div style={{ background: "#ffdddd", color: "#d32f2f", padding: "10px", borderRadius: "8px", marginBottom: "15px", textAlign: "center" }}>{error}</div>}
          
          <form onSubmit={handleSubmit}>
            
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" ref={usernameRef} className="form-input" placeholder="Choose a username" required />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" ref={emailRef} className="form-input" placeholder="name@example.com" required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" ref={passwordRef} className="form-input" placeholder="6+ characters" required />
                </div>
                <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" ref={passwordConfirmRef} className="form-input" placeholder="Re-enter password" required />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Home Address</label>
                <textarea ref={addressRef} className="form-textarea" placeholder="Enter your full address..." required></textarea>
            </div>

            <div className="form-group">
                <label className="form-label">Health Condition / Vulnerability</label>
                <select ref={diseaseRef} className="form-select" required defaultValue="">
                    <option value="" disabled>Select a condition (if any)</option>
                    <option value="none">None</option>
                    <option value="asthma">Asthma</option>
                    <option value="copd">COPD</option>
                    <option value="heart_disease">Heart Disease</option>
                    <option value="elderly">Elderly</option>
                    <option value="pregnant">Pregnant</option>
                    <option value="other">Other Respiratory Issue</option>
                </select>
            </div>
            
            <button disabled={loading} type="submit" className="auth-button" style={{ marginTop: "1rem" }}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>
          
          <div className="auth-footer">
            Already have an account? <Link to="/login">Log In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}