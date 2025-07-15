<!DOCTYPE html>
<html lang="en" class="{{ Session::get('theme', 'light') }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Bitrix24 CRM Automation Suite</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
    <link href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css" rel="stylesheet">
    <style>
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
        }

        .dark .modal-content {
            background: #1f2937;
            color: white;
        }
    </style>
</head>

<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <div class="container mx-auto p-4">
        <!-- Theme Toggle -->
        <div class="mb-4">
            <button id="theme-toggle" class="bg-blue-500 text-white px-4 py-2 rounded">Toggle Theme</button>
        </div>

        <!-- Toast Container -->
        @if (session('success'))
            <script>
                Toastify({
                    text: "{{ session('success') }}",
                    duration: 3000,
                    backgroundColor: "#10B981",
                }).showToast();
            </script>
        @endif
        @if ($errors->any())
            <script>
                Toastify({
                    text: "{{ $errors->first('msg') }}",
                    duration: 3000,
                    backgroundColor: "#EF4444",
                }).showToast();
            </script>
        @endif

        <!-- Content -->
        @yield('content')

        <!-- Delete Modal -->
        <div id="delete-modal" class="modal">
            <div class="modal-content">
                <h2 class="text-lg font-bold mb-4">Confirm Delete</h2>
                <p>Are you sure you want to delete this lead?</p>
                <form id="delete-form" method="POST">
                    @csrf
                    @method('DELETE')
                    <div class="mt-4 flex justify-end">
                        <button type="button" class="bg-gray-500 text-white px-4 py-2 rounded mr-2"
                            onclick="closeModal()">Cancel</button>
                        <button type="submit" class="bg-red-500 text-white px-4 py-2 rounded">Delete</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        // CSRF Token Setup
        $.ajaxSetup({
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            }
        });

        // Theme Toggle
        $('#theme-toggle').click(function () {
            const currentTheme = $('html').hasClass('dark') ? 'dark' : 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            $('html').removeClass('light dark').addClass(newTheme);
            $.post('/theme', { theme: newTheme });
        });

        // Modal Control
        function openDeleteModal(url) {
            $('#delete-form').attr('action', url);
            $('#delete-modal').show();
        }

        function closeModal() {
            $('#delete-modal').hide();
        }
    </script>
</body>

</html>