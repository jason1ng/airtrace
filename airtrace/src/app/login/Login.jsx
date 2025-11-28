import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import "../global.css";

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      await login(emailRef.current.value, passwordRef.current.value);
      navigate("/map");
    } catch (err) {
      setError("Failed to log in: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      {/* Left Side - Branding */}
      <div className="auth-branding">
        <h1>AirTrace</h1>
        <p>Navigate your city with cleaner air.</p>
      </div>

      {/* Right Side - Form */}
      <div className="auth-form-container">
        <div className="auth-form-box">
          <h2>Welcome Back</h2>
          {error && <div style={{ background: "#ffdddd", color: "#d32f2f", padding: "10px", borderRadius: "8px", marginBottom: "15px", textAlign: "center" }}>{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" ref={emailRef} className="form-input" placeholder="name@example.com" required />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" ref={passwordRef} className="form-input" placeholder="Enter your password" required />
            </div>
            
            <button disabled={loading} type="submit" className="auth-button">
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>
          
          <div className="auth-footer">
            Don't have an account? <Link to="/signup">Sign Up Now</Link>
          </div>
        </div>
      </div>
    </div>
  );
}