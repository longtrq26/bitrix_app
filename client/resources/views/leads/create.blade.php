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

        <h1 class="text-2xl font-bold">Thêm Lead mới</h1>

        <!-- Form thêm lead -->
        <form method="POST" action="{{ route('leads.store') }}" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
            id="create-lead-form">
            @csrf
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tiêu đề *</label>
                    <input type="text" name="TITLE" value="{{ e(old('TITLE')) }}" required maxlength="100"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                    @error('TITLE')
                        <p class="text-red-500 text-sm mt-1">{{ $message }}</p>
                    @enderror
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tên</label>
                    <input type="text" name="NAME" value="{{ e(old('NAME')) }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Email</label>
                    <input type="email" name="EMAIL" value="{{ e(old('EMAIL')) }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                    @error('EMAIL')
                        <p class="text-red-500 text-sm mt-1">{{ $message }}</p>
                    @enderror
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Số điện thoại</label>
                    <input type="text" name="PHONE" value="{{ e(old('PHONE')) }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Trạng thái</label>
                    <select name="STATUS_ID"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">Chọn trạng thái</option>
                        @foreach ($statuses ?? [] as $status)
                            <option value="{{ e($status['STATUS_ID']) }}" {{ old('STATUS_ID') == $status['STATUS_ID'] ? 'selected' : '' }}>
                                {{ e($status['NAME']) }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Nguồn</label>
                    <select name="SOURCE_ID"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">Chọn nguồn</option>
                        @foreach ($sources ?? [] as $source)
                            <option value="{{ e($source['STATUS_ID']) }}" {{ old('SOURCE_ID') == $source['STATUS_ID'] ? 'selected' : '' }}>
                                {{ e($source['NAME']) }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium dark:text-gray-300">Ghi chú</label>
                    <textarea name="COMMENTS" rows="3" maxlength="1000"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">{{ e(old('COMMENTS')) }}</textarea>
                    @error('COMMENTS')
                        <p class="text-red-500 text-sm mt-1">{{ $message }}</p>
                    @enderror
                </div>
            </div>
            <div class="mt-4 flex justify-end space-x-2">
                <button type="submit"
                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center">
                    <span id="loading"
                        class="hidden animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    Thêm Lead
                </button>
                <a href="{{ route('leads.index') }}" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">Quay
                    lại</a>
            </div>
        </form>
    </div>

    @push('scripts')
        <script>
            document.getElementById('create-lead-form').addEventListener('submit', function () {
                const button = this.querySelector('button[type="submit"]');
                button.disabled = true;
                document.getElementById('loading').classList.remove('hidden');
            });
        </script>
    @endpush
@endsection