@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        <h1 class="text-2xl font-bold">Chỉnh sửa Lead #{{ $id }}</h1>

        <!-- Form cập nhật lead -->
        <form method="POST" action="{{ route('leads.update', $id) }}"
            class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            @csrf
            @method('PATCH')
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tiêu đề *</label>
                    <input type="text" name="TITLE" value="{{ old('TITLE', $lead['TITLE'] ?? '') }}" required
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                    @error('TITLE') <p class="text-red-500 text-sm mt-1">{{ $message }}</p> @enderror
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tên</label>
                    <input type="text" name="NAME" value="{{ old('NAME', $lead['NAME'] ?? '') }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Email</label>
                    <input type="email" name="EMAIL" value="{{ old('EMAIL', $lead['EMAIL'][0]['VALUE'] ?? '') }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                    @error('EMAIL') <p class="text-red-500 text-sm mt-1">{{ $message }}</p> @enderror
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Số điện thoại</label>
                    <input type="text" name="PHONE" value="{{ old('PHONE', $lead['PHONE'][0]['VALUE'] ?? '') }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Trạng thái</label>
                    <select name="STATUS_ID"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">Chọn trạng thái</option>
                        @foreach ($statuses ?? [] as $status)
                            <option value="{{ $status['STATUS_ID'] }}" {{ old('STATUS_ID', $lead['STATUS_ID'] ?? '') == $status['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $status['NAME'] }}
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
                            <option value="{{ $source['STATUS_ID'] }}" {{ old('SOURCE_ID', $lead['SOURCE_ID'] ?? '') == $source['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $source['NAME'] }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium dark:text-gray-300">Ghi chú</label>
                    <textarea name="COMMENTS" rows="3"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">{{ old('COMMENTS', $lead['COMMENTS'] ?? '') }}</textarea>
                    @error('COMMENTS') <p class="text-red-500 text-sm mt-1">{{ $message }}</p> @enderror
                </div>
            </div>
            <div class="mt-4 flex justify-end space-x-2">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Cập nhật
                    Lead</button>
                <a href="{{ route('leads.show', $id) }}"
                    class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">Quay lại</a>
            </div>
        </form>
    </div>
@endsection