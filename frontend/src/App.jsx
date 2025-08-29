import { useEffect } from "react";
import "./App.css";

// Use env variable for backend, fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function App() {
  useEffect(() => {
    // Set min date for date picker (today)
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("future-date").setAttribute("min", today);
  }, []);

  function sendLetter() {
    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("future-email").value.trim();
    const date = document.getElementById("future-date").value;
    const time = document.getElementById("future-time").value;
    const letter = document.querySelector(".letter-box").value.trim();

    if (!firstName || !lastName || !email || !date || !time || !letter) {
      alert("Please fill in all fields.");
      return;
    }

    // Combine date and time into MySQL DATETIME format string
    const deliveryDateTime = `${date} ${time}:00`;

    fetch(`${API_BASE_URL}/send-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        deliveryDateTime,
        letter,
      }),
    })
      .then((res) => res.json())
      .then((data) => alert(data.message))
      .catch(() => alert("Something went wrong. Try again later."));
  }

  return (
    <>
      {/* Navigation */}
      <div className="nav">
        <span>Welcome!</span>
      </div>

      {/* Main content */}
      <div className="container">
        <div className="main-content">
          <h1>Write a Letter to your future self</h1>
          <p>
            Write. Pick a date and time. Send. Verify. That’s it 😊<br />
            Your letter is safe with us - we’ve sent over 20 million letters in 20 years!
          </p>
          <textarea className="letter-box" placeholder="Dear FutureMe," />
        </div>

        <div className="sidebar">
          <div className="delivery-options">
            <label htmlFor="first-name">First Name</label>
            <input type="text" id="first-name" placeholder="Enter your first name" />

            <label htmlFor="last-name">Last Name</label>
            <input type="text" id="last-name" placeholder="Enter your last name" />

            <label htmlFor="future-date">Pick a delivery date</label>
            <input type="date" id="future-date" />

            <label htmlFor="future-time">Pick a delivery time</label>
            <input type="time" id="future-time" />

            <label htmlFor="future-email">Your email</label>
            <input type="email" id="future-email" placeholder="Enter your email" />

            <button className="send-btn" onClick={sendLetter}>
              Send to the Future
            </button>
          </div>
        </div>
      </div>
    </>
  );
}