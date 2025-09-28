import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true }
});

export async function upsertMediaRecord(tableName, item) {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      post_id: item.postId,
      sequence: item.sequence
    },
    UpdateExpression: `SET #state = :state, #version = :version, #paths = :paths, #meta = :meta, #updatedAt = :updatedAt` +
      `, #moderation = :moderation`,
    ExpressionAttributeNames: {
      '#state': 'state',
      '#version': 'version',
      '#paths': 'paths',
      '#meta': 'metadata',
      '#moderation': 'moderation',
      '#updatedAt': 'updated_at'
    },
    ExpressionAttributeValues: {
      ':state': item.state,
      ':version': item.version,
      ':paths': item.paths,
      ':meta': item.metadata,
      ':moderation': item.moderation,
      ':updatedAt': new Date().toISOString()
    }
  });

  await docClient.send(command);
}
