@extends('layouts.app')

@section('content')
    <div class="container mx-auto p-6">
        <h1 class="text-2xl font-bold mb-4">Cập nhật Lead</h1>

        <form method="POST" action="/leads/{{ $id }}/update">
            @csrf

            <div class="mb-4">
                <label class="block font-semibold mb-2">Tiêu đề *</label>
                <input type="text" name="TITLE" value="{{ old('TITLE') }}" class="border p-2 rounded w-full" required>
            </div>

            <div class="mb-4">
                <label class="block font-semibold mb-2">Ghi chú</label>
                <textarea name="COMMENTS" class="border p-2 rounded w-full">{{ old('COMMENTS') }}</textarea>
            </div>

            <button type="submit" class="bg-yellow-600 text-white px-4 py-2 rounded">Cập nhật</button>
        </form>
    </div>
@endsection