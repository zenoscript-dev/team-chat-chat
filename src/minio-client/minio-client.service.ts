import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MinioClient, MinioService } from 'nestjs-minio-client';
import * as crypto from 'crypto';
import { BufferedFile } from './file.model';

@Injectable()
export class MinioClientService {

    constructor(private readonly minio: MinioService) {

        this.logger = new Logger('MinioService');

        // THIS IS THE POLICY
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: {
                        AWS: ['*'],
                    },
                    Action: [
                        's3:ListBucketMultipartUploads',
                        's3:GetBucketLocation',
                        's3:ListBucket',
                    ],
                    Resource: ['arn:aws:s3:::test-bucket'], // Change this according to your bucket name
                },
                {
                    Effect: 'Allow',
                    Principal: {
                        AWS: ['*'],
                    },
                    Action: [
                        's3:PutObject',
                        's3:AbortMultipartUpload',
                        's3:DeleteObject',
                        's3:GetObject',
                        's3:ListMultipartUploadParts',
                    ],
                    Resource: ['arn:aws:s3:::test-bucket/*'], // Change this according to your bucket name
                },
            ],
        };


        this.client.setBucketPolicy(
            process.env.MINIO_BUCKET_NAME,
            JSON.stringify(policy),
            function (err) {
                if (err) throw err;

                console.log('Bucket policy set');
            },
        );
    };




    private readonly logger: Logger;
    private readonly bucketName = process.env.MINIO_BUCKET_NAME;

    public get client() {
        return this.minio.client;
    }

    public async upload(file: BufferedFile, fileDetails : {id: string, referenceType: string, referenceId: string},bucketName: string = this.bucketName) {
        const {id, referenceType, referenceId} = fileDetails;
        if (!(file.mimetype.includes('jpeg') || file.mimetype.includes('png'))) {
            throw new HttpException(
                'File type not supported',
                HttpStatus.BAD_REQUEST,
            );
        }
        const timestamp = Date.now().toString();
        const hashedFileName = crypto
            .createHash('md5')
            .update(timestamp)
            .digest('hex');
        const extension = file.originalname.substring(
            file.originalname.lastIndexOf('.'),
            file.originalname.length,
        );

        // this is how each file details will come once the file is uploaded.
        // {
        //     fieldname: 'image',
        //     originalname: 'Screenshot 2024-07-29 at 1.13.45 PM.png',
        //     encoding: '7bit',
        //     mimetype: 'image/png',
        //     buffer: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 07 80 00 00 04 38 08 06 00 00 00 e8 d3 c1 43 00 00 01 5e 69 43 43 50 49 43 43 20 50 72 6f 66 69 ... 498149 more bytes>,
        //     size: 498199
        //   }
        const metaData = {
            'Content-Type': file.mimetype,
            // 'filename': file.originalname,
            'mimetype': file.mimetype,
            'referenceId': referenceId, // refrence id from db
            'referenceType': referenceType, // file refrerence type from db
            'id': id, // file unqid from db
            // 'x-amz-meta-filename': "red"
            // filename
            //referencetYPE
            //REFERENCESiD
            //UUID
            
        };

        // We need to append the extension at the end otherwise Minio will save it as a generic file
        const fileName = hashedFileName + extension;
        const unqurl = await this.encodeAndDecodeFileUri({'referenceId': referenceId,
            'referenceType': referenceType, 
            'id': id,'fileName': fileName }, "construct");
        console.log(fileName);

        this.client.putObject(
            bucketName,
            unqurl,
            file.buffer,
            metaData,
        );



        return {
            url: unqurl,
        };
    }

    async delete(objetName: string, bucketName: string = this.bucketName) {
        this.client.removeObject(bucketName, objetName);
    }

    async get(objetName: string, bucketName: string = this.bucketName) {
        return await this.client.presignedUrl('GET', this.bucketName, objetName)
    }


    private async encodeAndDecodeFileUri(details: {id: string, referenceType: string, referenceId: string, fileName: string}, type: 'construct' | 'deconstruct'): Promise<string>{
        const {id, referenceType, referenceId, fileName} = details;
        let url;
        if(type === 'construct'){
            url = `${id}_${referenceType}_${referenceId}_${process.env.MINIO_FILE_UNQ_ID}`
        }
        return url;
    }
}
