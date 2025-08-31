// App.jsx
import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function App() {
  const [modalMessage, setModalMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("future-date").setAttribute("min", today);
  }, []);

  function openModal(message) {
    setModalMessage(message);
    setShowModal(true);
  }

  function sendLetter() {
    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("future-email").value.trim();
    const date = document.getElementById("future-date").value;
    const time = document.getElementById("future-time").value;
    const letter = document.querySelector(".letter-box").value.trim();

    if (!firstName || !lastName || !email || !date || !time || !letter) {
      openModal("⚠️ Please fill in all fields.");
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    const [year, month, day] = date.split("-").map(Number);
    const istDate = new Date(Date.UTC(year, month - 1, day, hours, minutes) - 5.5 * 60 * 60 * 1000);
    const deliveryDateTime = istDate.toISOString().slice(0, 19).replace("T", " ");

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
      .then((data) => openModal(data.message || "✅ Letter sent!"))
      .catch(() => openModal("❌ Something went wrong. Try again later."));
  }

  return (
    <>
      <div className="container">
        <div className="main-content">
          <h1>Write a Letter to Your Future Self 🌸</h1>
          <p>
            A colorful message of hope, love, or reflection. <br />
            Pick a date, and let the future surprise you 💌
          </p>
          <textarea className="letter-box" placeholder="Dear Future Me..." />
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
              Send to the Future 🌈
            </button>
          </div>
        </div>
      </div>

      {/* Custom Modal */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p>{modalMessage}</p>
            <button onClick={() => setShowModal(false)}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}
