import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Mã hóa dữ liệu đầu vào.
   * @param data Dữ liệu cần mã hóa (có thể là bất kỳ kiểu dữ liệu nào sẽ được JSON.stringify).
   * @returns Chuỗi đã được mã hóa ở định dạng 'ivHex:encryptedDataHex'.
   */
  encrypt(data: any): string {
    // Lấy khóa mã hóa từ cấu hình
    const key = this.getEncryptionKey();

    // Tạo một Initialization Vector (IV) ngẫu nhiên 16 byte để đảm bảo mỗi lần mã hóa là duy nhất
    const iv = crypto.randomBytes(16);

    // Tạo đối tượng cipher sử dụng thuật toán AES-256-CBC, khóa và IV
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    // Cập nhật cipher với dữ liệu đã được JSON.stringify và mã hóa thành hex
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    // Kết thúc quá trình mã hóa và lấy phần còn lại của dữ liệu đã mã hóa
    encrypted += cipher.final('hex');

    // Trả về IV và dữ liệu đã mã hóa, phân tách bởi dấu ':'
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Giải mã một chuỗi đã được mã hóa.
   * @param encrypted Chuỗi đã mã hóa ở định dạng 'ivHex:encryptedDataHex'.
   * @returns Dữ liệu đã giải mã (dưới dạng đối tượng JSON).
   */
  decrypt(encrypted: string): any {
    // Tách chuỗi mã hóa thành IV (hex) và dữ liệu mã hóa
    const [ivHex, encryptedData] = encrypted.split(':');

    // Lấy khóa mã hóa từ cấu hình
    const key = this.getEncryptionKey();

    // Chuyển đổi IV từ chuỗi hex trở lại Buffer
    const iv = Buffer.from(ivHex, 'hex');

    // Tạo đối tượng decipher sử dụng thuật toán AES-256-CBC, khóa và IV
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    // Cập nhật decipher với dữ liệu mã hóa (hex) và giải mã thành utf8
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    // Kết thúc quá trình giải mã và lấy phần còn lại của dữ liệu đã giải mã
    decrypted += decipher.final('utf8');

    // Phân tích cú pháp chuỗi JSON đã giải mã thành đối tượng JavaScript
    return JSON.parse(decrypted);
  }

  /**
   * Lấy khóa mã hóa từ ConfigService và kiểm tra định dạng của khóa.
   * @returns Khóa mã hóa dưới dạng Buffer.
   * @throws Error nếu ENCRYPTION_KEY không được định nghĩa hoặc không đúng định dạng.
   */
  private getEncryptionKey(): Buffer {
    // Lấy giá trị của biến môi trường 'ENCRYPTION_KEY'
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    // Kiểm tra xem khóa có tồn tại và có phải là chuỗi hex 64 ký tự hay không
    if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }

    // Chuyển đổi khóa từ chuỗi hex sang Buffer
    return Buffer.from(key, 'hex');
  }
}
