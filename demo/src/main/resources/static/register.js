function register() {
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value.trim();

    if (!username || !password) {
        alert("Vui lòng nhập đầy đủ!");
        return;
    }

    if (localStorage.getItem(username)) {
        alert("Tài khoản đã tồn tại!");
        return;
    }

    localStorage.setItem(username, JSON.stringify({ password }));
    alert("Đăng ký thành công!");
    window.location.href = "/login.html";
}
