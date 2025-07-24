<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ 'Bitrix24 CRM Automation Suite' }}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    @stack('scripts')
</head>

<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
    <div class="max-w-7xl mx-auto p-6 space-y-6">
        <header class="flex justify-between items-center">
            <h1 class="text-3xl font-bold">{{ $title ?? 'Bitrix24 CRM Automation Suite' }}</h1>
            <nav>
                <a href="{{ route('leads.index') }}" class="text-blue-600 dark:text-blue-400 hover:underline">Leads</a>
                <a href="{{ route('analytics.index') }}"
                    class="ml-4 text-blue-600 dark:text-blue-400 hover:underline">Analytics</a>
                <form action="{{ route('logout') }}" method="POST" class="inline ml-4">
                    @csrf
                    <button type="submit" class="text-red-600 dark:text-red-400 hover:underline">Đăng xuất</button>
                </form>
            </nav>
        </header>

        @if (session('success'))
            <script>
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: '{{ session('success') }}',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            </script>
        @endif
        @if ($errors->has('msg'))
            <script>
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: '{{ $errors->first('msg') }}',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            </script>
        @endif
        @if (isset($recentWebhooks) && $recentWebhooks > 0)
            <script>
                Swal.fire({
                    icon: 'info',
                    title: 'Cập nhật mới',
                    text: '{{ $recentWebhooks }} sự kiện webhook mới đã được ghi nhận. Vui lòng làm mới trang.',
                    confirmButtonText: 'Làm mới',
                }).then((result) => {
                    if (result.isConfirmed) window.location.reload();
                });
            </script>
        @endif

        <main>
            @yield('content')
        </main>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.4/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>
    <script>
        @if ($errors->any() && !$errors->has('msg'))
            toastr.error("{{ $errors->first() }}");
        @endif
    </script>
</body>

</html>