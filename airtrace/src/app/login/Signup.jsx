import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import "../global.css"; 

export default function Signup() {
  // Refs for all form fields
  const usernameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
  const addressRef = useRef();
  const diseaseRef = useRef(); // Ref for the dropdown

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

      // 1. Create the user in Firebase Auth
      const userCredential = await signup(emailRef.current.value, passwordRef.current.value);
      const user = userCredential.user;

      // 2. Gather the extra data
      const userData = {
        uid: user.uid,
        username: usernameRef.current.value,
        email: emailRef.current.value,
        address: addressRef.current.value,
        healthCondition: diseaseRef.current.value,
      };

      // FOR HACKATHON: Log the data to console to prove you captured it.
      // In a real app, you would save this `userData` object to Firestore here.
      console.log("--- User Account Created ---");
      console.log("Full User Data Captured:", userData);
      console.log("----------------------------");

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
        {/* Added max-height and overflow for scrolling on smaller screens if form is long */}
        <div className="auth-form-box" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <h2>Create Account</h2>
          {error && <div style={{ background: "#ffdddd", color: "#d32f2f", padding: "10px", borderRadius: "8px", marginBottom: "15px", textAlign: "center" }}>{error}</div>}
          
          <form onSubmit={handleSubmit}>
            
            {/* Username */}
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" ref={usernameRef} className="form-input" placeholder="Choose a username" required />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" ref={emailRef} className="form-input" placeholder="name@example.com" required />
            </div>

            {/* Password & Confirm */}
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

            {/* Home Address */}
            <div className="form-group">
                <label className="form-label">Home Address</label>
                <textarea ref={addressRef} className="form-textarea" placeholder="Enter your full address for better routing..." required></textarea>
            </div>

            {/* Health Condition Dropdown */}
            <div className="form-group">
                <label className="form-label">Health Condition / Vulnerability</label>
                <select ref={diseaseRef} className="form-select" required defaultValue="">
                    <option value="" disabled>Select a condition (if any)</option>
                    <option value="none">None</option>
                    <option value="asthma">Asthma</option>
                    <option value="copd">COPD (Chronic Obstructive Pulmonary Disease)</option>
                    <option value="heart_disease">Heart Disease</option>
                    <option value="elderly">Elderly</option>
                    <option value="pregnant">Pregnant</option>
                    <option value="other">Other Respiratory Issue</option>
                </select>
                <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>We use this to prioritize cleaner routes for you.</small>
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