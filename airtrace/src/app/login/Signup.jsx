import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Signup() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
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
      await signup(emailRef.current.value, passwordRef.current.value);
      navigate("/map"); // Redirects to Map after successful signup
    } catch (err) {
      console.error(err);
      setError("Failed to create an account: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-container" style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2 style={{ textAlign: "center" }}>Join AirTrace</h2>
      {error && <div style={{ background: "#ffdddd", color: "red", padding: "10px", marginBottom: "10px" }}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="email" ref={emailRef} placeholder="Email Address" required style={{ padding: "10px" }} />
        <input type="password" ref={passwordRef} placeholder="Password" required style={{ padding: "10px" }} />
        <input type="password" ref={passwordConfirmRef} placeholder="Confirm Password" required style={{ padding: "10px" }} />
        
        <button disabled={loading} type="submit" style={{ padding: "10px", background: "#007bff", color: "white", border: "none", cursor: "pointer" }}>
          Sign Up
        </button>
      </form>
      
      <div style={{ marginTop: "15px", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </div>
  );
}