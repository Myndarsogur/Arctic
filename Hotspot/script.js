/* styles.css */
html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: sans-serif;
  }
  
  /* Dökk/ljós slæða fyrir modalið */
  .info-modal {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: none; /* Falið í byrjun */
    align-items: center;
    justify-content: center;
  }
  
  .info-content {
    background-color: #fff;
    max-width: 600px;
    width: 90%;
    padding: 20px;
    border-radius: 8px;
    position: relative;
    text-align: center;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  }
  
  .close-btn {
    position: absolute;
    top: 10px; right: 15px;
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
  }
  