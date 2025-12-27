function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Vui lòng nhập đầy đủ!");
        return;
    }

    const user = JSON.parse(localStorage.getItem(username));

    if (!user || user.password !== password) {
        alert("Sai tài khoản hoặc mật khẩu!");
        return;
    }

    localStorage.setItem("currentUser", username);
    window.location.href = "/chat.html";
}
