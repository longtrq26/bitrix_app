@extends('layouts.app')

@section('content')
    <div class="container mx-auto p-6">
        <h1 class="text-2xl font-bold mb-4">Thêm Lead mới</h1>

        <form method="POST" action="/leads">
            @csrf

            <div class="mb-4">
                <label class="block font-semibold mb-2">Tiêu đề *</label>
                <input type="text" name="TITLE" class="border p-2 rounded w-full" required>
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Email</label>
                <input type="email" name="EMAIL" class="border p-2 rounded w-full">
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Số điện thoại</label>
                <input type="text" name="PHONE" class="border p-2 rounded w-full">
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Trạng thái</label>
                <input type="text" name="STATUS_ID" class="border p-2 rounded w-full">
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Nguồn</label>
                <input type="text" name="SOURCE_ID" class="border p-2 rounded w-full">
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Ghi chú</label>
                <textarea name="COMMENTS" class="border p-2 rounded w-full"></textarea>
            </div>

            <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded">Tạo Lead</button>
        </form>
    </div>
@endsection