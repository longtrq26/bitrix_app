@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        <h1 class="text-2xl font-bold">Chi tiết Lead #{{ $id }}</h1>

        <!-- Nút chuyển đến trang chỉnh sửa lead -->
        <div class="flex justify-end">
            <a href="{{ route('leads.edit', $id) }}"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Chỉnh sửa Lead</a>
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
                            <td class="px-6 py-4 dark:text-white">{{ $task['ID'] ?? $task['id'] ?? 'N/A' }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ $task['TITLE'] ?? $task['title'] ?? 'N/A' }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ $task['STATUS'] ?? $task['status'] ?? 'N/A' }}</td>
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
                            <td class="px-6 py-4 dark:text-white">{{ $deal['ID'] ?? $deal['id'] ?? 'N/A' }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ $deal['TITLE'] ?? $deal['title'] ?? 'N/A' }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ $deal['OPPORTUNITY'] ?? $deal['opportunity'] ?? 'N/A' }}
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" class="px-6 py-4 text-center dark:text-white">Không có deal nào</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div class="flex justify-end">
            <button onclick="window.location.reload()"
                class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">Reload</button>
        </div>
    </div>
@endsection