<!DOCTYPE html>
<html>

<head>
    <title>Bitrix24 CRM Automation Suite</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.11.5/css/jquery.dataTables.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.css" rel="stylesheet">
</head>

<body class="{{ session('theme', 'light') }} container mx-auto p-4">
    <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold dark:text-white">Danh sách Lead</h1>
        <button onclick="toggleTheme()" class="bg-gray-500 text-white px-4 py-2 rounded dark:bg-gray-700">
            Chuyển Theme
        </button>
    </div>

    @if(session('success'))
        <script> toastr.success("{{ session('success') }}", "Thành công"); </script>
    @endif
    @if($errors->any())
        <script> toastr.error("{{ $errors->first() }}", "Lỗi"); </script>
    @endif

    <div class="mb-4">
        <a href="{{ url('/leads/create') }}"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded dark:bg-blue-500">
            + Thêm Lead
        </a>
    </div>

    <form id="filter-form" method="GET" action="/leads" class="mb-4 flex space-x-2">
        <input type="text" name="find" placeholder="Tìm kiếm..." value="{{ request('find') }}"
            class="border p-2 rounded dark:bg-gray-700 dark:text-white">
        <select name="status" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
            <option value="">Tất cả trạng thái</option>
            @foreach($statuses as $status)
                <option value="{{ $status['STATUS_ID'] }}" {{ request('status') == $status['STATUS_ID'] ? 'selected' : '' }}>
                    {{ $status['NAME'] }}
                </option>
            @endforeach
        </select>
        <select name="source" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
            <option value="">Tất cả nguồn</option>
            @foreach($sources as $source)
                <option value="{{ $source['STATUS_ID'] }}" {{ request('source') == $source['STATUS_ID'] ? 'selected' : '' }}>
                    {{ $source['NAME'] }}
                </option>
            @endforeach
        </select>
        <input type="date" name="date" value="{{ request('date') }}"
            class="border p-2 rounded dark:bg-gray-700 dark:text-white">
        <select name="sort" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
            <option value="">Sắp xếp mặc định</option>
            <option value="DATE_CREATE" {{ request('sort') == 'DATE_CREATE' ? 'selected' : '' }}>Ngày tạo</option>
            <option value="TITLE" {{ request('sort') == 'TITLE' ? 'selected' : '' }}>Tiêu đề</option>
        </select>
        <button type="submit" class="bg-blue-500 text-white p-2 rounded dark:bg-blue-600">Lọc</button>
    </form>

    <table id="leads-table" class="w-full border dark:border-gray-600">
        <thead class="bg-gray-100 dark:bg-gray-700">
            <tr>
                <th class="p-2 dark:text-white">ID</th>
                <th class="p-2 dark:text-white">Tiêu đề</th>
                <th class="p-2 dark:text-white">Trạng thái</th>
                <th class="p-2 dark:text-white">Hành động</th>
            </tr>
        </thead>
    </table>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script>
        $(document).ready(function () {
            const table = $('#leads-table').DataTable({
                ajax: {
                    url: '/leads/json',
                    data: function (d) {
                        d.find = $('input[name="find"]').val();
                        d.status = $('select[name="status"]').val();
                        d.source = $('select[name="source"]').val();
                        d.date = $('input[name="date"]').val();
                        d.sort = $('select[name="sort"]').val();
                    },
                    dataSrc: 'leads',
                    beforeSend: () => {
                        Swal.fire({
                            title: 'Đang tải...',
                            allowOutsideClick: false,
                            didOpen: () => Swal.showLoading(),
                        });
                    },
                    complete: () => Swal.close(),
                    error: (xhr) => {
                        Swal.close();
                        if (xhr.status === 401) {
                            window.location.href = '/login';
                        } else if (xhr.status === 429) {
                            toastr.error('Quá nhiều yêu cầu, vui lòng thử lại sau', 'Lỗi');
                        } else {
                            toastr.error('Không thể tải dữ liệu', 'Lỗi');
                        }
                    },
                },
                columns: [
                    { data: 'ID' },
                    { data: 'TITLE' },
                    { data: 'STATUS_ID', defaultContent: 'N/A' },
                    {
                        data: null,
                        render: (data) => `
                            <a href="/leads/${data.ID}/edit" class="text-blue-500 dark:text-blue-300">Sửa</a>
                            <form action="/leads/${data.ID}" method="POST" class="inline-block" onsubmit="return confirm('Xác nhận xóa lead này?')">
                                <input type="hidden" name="_token" value="${document.querySelector('meta[name="csrf-token"]').content}">
                                <input type="hidden" name="_method" value="DELETE">
                                <button type="submit" class="text-red-500 dark:text-red-300">Xóa</button>
                            </form>
                        `,
                    },
                ],
                responsive: true,
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.11.5/i18n/vi.json',
                },
            });

            $('#filter-form').on('submit', function (e) {
                e.preventDefault();
                table.ajax.reload();
            });
        });

        function toggleTheme() {
            const current = document.body.classList.contains('dark') ? 'dark' : 'light';
            const newTheme = current === 'dark' ? 'light' : 'dark';
            document.body.classList.toggle('dark');
            localStorage.setItem('theme', newTheme);
            fetch('/set-theme', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ theme: newTheme }),
            });
        }

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark');
        }
    </script>
</body>

</html>