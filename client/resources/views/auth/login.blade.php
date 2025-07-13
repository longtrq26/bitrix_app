<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Đăng nhập Bitrix24</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>

<body class="bg-gray-100 flex items-center justify-center h-screen">
    <form id="authForm" class="bg-white p-6 rounded shadow w-96">
        <h2 class="text-2xl font-bold mb-4 text-center">Đăng nhập Bitrix24</h2>

        <label class="block mb-2">Nhập domain Bitrix24:</label>
        <input type="text" id="domainInput" placeholder="yourcompany.bitrix24.vn"
            class="border border-gray-300 p-2 w-full rounded mb-4" required>

        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded">
            Tiếp tục đăng nhập
        </button>
    </form>

    <script>
        document.getElementById('authForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const domain = document.getElementById('domainInput').value.trim();
            if (!domain) {
                alert('Vui lòng nhập domain Bitrix24');
                return;
            }
            // Redirect trực tiếp đến API NestJS để bắt đầu OAuth flow
            window.location.href = `http://localhost:3001/api/auth/redirect?domain=${domain}`;
        });
    </script>

</body>

</html>