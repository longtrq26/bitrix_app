@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        @if (session('error'))
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                {{ session('error') }}
            </div>
        @endif
        @if (session('success'))
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                {{ session('success') }}
            </div>
        @endif

        <h1 class="text-2xl font-bold">Chi tiết Lead #{{ e($id) }}</h1>

        <!-- Nút chỉnh sửa và reload -->
        <div class="flex justify-end space-x-2">
            <a href="{{ route('leads.edit', $id) }}"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Chỉnh sửa Lead</a>
            <button id="reload-button"
                class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center">
                <span id="loading"
                    class="hidden animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                Reload
            </button>
        </div>

        <!-- Thông tin chi tiết lead -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">Thông tin Lead</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tiêu đề</label>
                    <p class="dark:text-white">{{ e($lead['TITLE'] ?? 'N/A') }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tên</label>
                    <p class="dark:text-white">{{ e($lead['NAME'] ?? 'N/A') }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Email</label>
                    <p class="dark:text-white">{{ e(isset($lead['EMAIL'][0]['VALUE']) ? $lead['EMAIL'][0]['VALUE'] : 'N/A') }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Số điện thoại</label>
                    <p class="dark:text-white">{{ e(isset($lead['PHONE'][0]['VALUE']) ? $lead['PHONE'][0]['VALUE'] : 'N/A') }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Trạng thái</label>
                    <p class="dark:text-white">{{ e(collect($statuses)->firstWhere('STATUS_ID', $lead['STATUS_ID'])['NAME'] ?? $lead['STATUS_ID'] ?? 'N/A') }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Nguồn</label>
                    <p class="dark:text-white">{{ e(collect($sources)->firstWhere('STATUS_ID', $lead['SOURCE_ID'])['NAME'] ?? $lead['SOURCE_ID'] ?? 'N/A') }}</p>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium dark:text-gray-300">Ghi chú</label>
                    <p class="dark:text-white">{{ e($lead['COMMENTS'] ?? 'N/A') }}</p>
                </div>
            </div>
        </div>

        <!-- Bảng task -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <h2 class="text-xl font-semibold p-6">Danh sách Task</h2>
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">ID</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Tiêu đề</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Trạng thái</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @forelse ($tasks as $task)
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td class="px-6 py-4 dark:text-white">{{ e($task['ID'] ?? $task['id'] ?? 'N/A') }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ e($task['TITLE'] ?? $task['title'] ?? 'N/A') }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ e($task['STATUS'] ?? $task['status'] ?? 'N/A') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" class="px-6 py-4 text-center dark:text-white">Không có task nào</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <!-- Bảng deal -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <h2 class="text-xl font-semibold p-6">Danh sách Deal</h2>
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">ID</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Tiêu đề</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Doanh thu</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @forelse ($deals as $deal)
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td class="px-6 py-4 dark:text-white">{{ e($deal['ID'] ?? $deal['id'] ?? 'N/A') }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ e($deal['TITLE'] ?? $deal['title'] ?? 'N/A') }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ e($deal['OPPORTUNITY'] ?? $deal['opportunity'] ?? 'N/A') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" class="px-6 py-4 text-center dark:text-white">Không có deal nào</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    @push('scripts')
        <script>
            document.getElementById('reload-button').addEventListener('click', function() {
                this.disabled = true;
                document.getElementById('loading').classList.remove('hidden');
                window.location.reload();
            });
        </script>
    @endpush
@endsection